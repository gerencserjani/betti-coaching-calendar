import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { CreateCoachDto } from './dto/create-coach.dto.js';
import type { UpdateCoachDto } from './dto/update-coach.dto.js';

@Injectable()
export class CoachesService {
  private readonly logger = new Logger(CoachesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /** ADMIN-only (see RolesGuard on the controller): every coach/business on the platform. */
  findAll(): Promise<Coach[]> {
    return this.prisma.coach.findMany({ orderBy: { name: 'asc' } });
  }

  update(coachId: string, dto: UpdateCoachDto): Promise<Coach> {
    return this.prisma.coach.update({ where: { id: coachId }, data: dto });
  }

  /** ADMIN-only: provision a brand-new coach/business. There is no public self-signup. */
  async create(dto: CreateCoachDto): Promise<Coach> {
    const existing = await this.prisma.coach.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A coach with that email already exists');
    }
    const passwordHash = await this.passwordService.hash(dto.password);
    return this.prisma.coach.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: CoachRole.COACH,
      },
    });
  }

  /** ADMIN-only. */
  revokeSessions(coachId: string): Promise<Coach> {
    return this.prisma.coach.update({
      where: { id: coachId },
      data: { sessionsRevokedAt: new Date() },
    });
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
