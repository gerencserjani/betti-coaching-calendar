import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import { TokenService } from '../auth/token.service.js';
import { CoachInviteEmailService } from './coach-invite-email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AcceptInviteDto } from './dto/accept-invite.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { InviteCoachDto } from './dto/invite-coach.dto.js';
import type { UpdateCoachDto } from './dto/update-coach.dto.js';

@Injectable()
export class CoachesService {
  private readonly logger = new Logger(CoachesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly coachInviteEmailService: CoachInviteEmailService,
  ) {}

  /** ADMIN-only (see RolesGuard on the controller): every coach/business on the platform. */
  findAll(): Promise<Coach[]> {
    return this.prisma.coach.findMany({ orderBy: { name: 'asc' } });
  }

  update(coachId: string, dto: UpdateCoachDto): Promise<Coach> {
    return this.prisma.coach.update({ where: { id: coachId }, data: dto });
  }

  /**
   * ADMIN-only: invite a brand-new coach/business to one of her own already
   * allow-listed origins (see AllowedOrigin/#35 -- the admin picks an
   * existing one rather than typing a URL freehand, so an invite can only
   * ever point at a real, known site). There is no public self-signup and
   * no Coach row is created here -- that would leave a half-formed account
   * sitting in the DB (email+name, no password) for however long it takes
   * the invite to be accepted. Instead this only mints a signed,
   * purpose-scoped token (same pattern as the Google OAuth connect state --
   * see TokenService) carrying the email+name+frontendUrl, and emails it to
   * that address. The Coach row -- email, name, password, AND frontendUrl
   * together -- is only created once the invite is redeemed (see
   * acceptInvite()).
   *
   * Rejected if `frontendUrl` isn't a known AllowedOrigin, if it already
   * belongs to another coach (one coach per site -- see Coach.frontendUrl),
   * or if `email` already belongs to a coach. Calling this again for the
   * same email+site before it's accepted (e.g. the first email got lost)
   * just mints and sends a fresh link -- nothing is persisted here, so
   * there's nothing to collide with or clean up.
   */
  async invite(dto: InviteCoachDto): Promise<void> {
    const existingCoach = await this.prisma.coach.findUnique({
      where: { email: dto.email },
    });
    if (existingCoach) {
      throw new ConflictException('A coach with that email already exists');
    }
    const allowedOrigin = await this.prisma.allowedOrigin.findUnique({
      where: { origin: dto.frontendUrl },
    });
    if (!allowedOrigin) {
      throw new NotFoundException('That site is not an allowed origin');
    }
    const coachForSite = await this.prisma.coach.findUnique({
      where: { frontendUrl: dto.frontendUrl },
    });
    if (coachForSite) {
      throw new ConflictException('This site already has a coach assigned');
    }
    const token = this.tokenService.signCoachInviteToken({
      email: dto.email,
      name: dto.name,
      frontendUrl: dto.frontendUrl,
    });
    await this.coachInviteEmailService.sendInvite(
      dto.email,
      dto.name,
      dto.frontendUrl,
      token,
    );
    this.logger.log(`Invite sent to ${dto.email} for ${dto.frontendUrl}`);
  }

  /**
   * Public (no auth -- the coach doesn't exist yet): verifies the invite
   * token and creates the Coach row for the first time, with
   * email+name+frontendUrl (carried in the token) and password (just set)
   * all together. The `Coach.frontendUrl @unique` constraint is what makes
   * this race-safe against two accept-invite calls for the same site: if
   * another invite to the same site was accepted first in the meantime,
   * this create hits a unique-constraint violation, which the global
   * PrismaExceptionFilter turns into a 409 (see common/prisma-exception.
   * filter.ts) instead of silently creating a second coach for that site.
   * Returns an access token too, same shape as login(), so the frontend can
   * log the coach straight in instead of making them log in again right
   * after.
   */
  async acceptInvite(
    dto: AcceptInviteDto,
  ): Promise<{ accessToken: string; coach: Coach }> {
    const { email, name, frontendUrl } =
      this.tokenService.verifyCoachInviteToken(dto.token);
    const existing = await this.prisma.coach.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('This invite has already been used');
    }
    const passwordHash = await this.passwordService.hash(dto.password);
    const coach = await this.prisma.coach.create({
      data: { email, name, passwordHash, frontendUrl, role: CoachRole.COACH },
    });
    this.logger.log(`Coach ${coach.id} (${coach.email}) created via invite`);
    const accessToken = this.tokenService.sign({
      sub: coach.id,
      email: coach.email,
      role: coach.role,
    });
    return { accessToken, coach };
  }

  /** ADMIN-only. */
  async revokeSessions(coachId: string): Promise<Coach> {
    const coach = await this.prisma.coach.update({
      where: { id: coachId },
      data: { sessionsRevokedAt: new Date() },
    });
    this.logger.warn(`Revoked all sessions for coach ${coachId}`);
    return coach;
  }

  /**
   * Self-service: always changes the caller's own password, never
   * someone else's -- there's no coachId param, it's derived entirely
   * from the authenticated `coach` passed in. Requires the current
   * password so a hijacked, still-logged-in session can't be used to
   * lock the real owner out silently.
   */
  async changePassword(coach: Coach, dto: ChangePasswordDto): Promise<void> {
    const matches = await this.passwordService.compare(
      dto.currentPassword,
      coach.passwordHash,
    );
    if (!matches) {
      this.logger.warn(
        `Rejected password change for coach ${coach.id}: wrong current password`,
      );
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.coach.update({
      where: { id: coach.id },
      data: { passwordHash },
    });
    this.logger.log(`Password changed for coach ${coach.id}`);
  }
}
