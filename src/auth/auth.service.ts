import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Coach } from '@prisma/client';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import { PasswordResetEmailService } from './password-reset-email.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly passwordResetEmailService: PasswordResetEmailService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; coach: Coach }> {
    const coach = await this.prisma.coach.findUnique({ where: { email } });
    if (
      !coach ||
      !(await this.passwordService.compare(password, coach.passwordHash))
    ) {
      // warn, not error -- expected to happen (typos), and it's also the
      // login-brute-force signal an operator would actually want to notice.
      this.logger.warn(`Failed login attempt for ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`Login: ${coach.email} (${coach.id})`);
    const accessToken = this.tokenService.sign({
      sub: coach.id,
      email: coach.email,
      role: coach.role,
    });
    return { accessToken, coach };
  }

  /**
   * Public, deliberately silent on an unknown email -- always resolves
   * the same way either way, so this can't be used to find out which
   * emails have an account here.
   *
   * The reset link's base is `coach.frontendUrl` when set (a real invited
   * coach -- see Coach.frontendUrl), falling back to the calling request's
   * own Origin/Referer (`requestOrigin`, resolved the same way as
   * Booking.originUrl) for a coach who predates the invite flow and has no
   * stored frontendUrl -- today, that's the one seeded ADMIN account.
   */
  async forgotPassword(
    email: string,
    requestOrigin: string | null,
  ): Promise<void> {
    const coach = await this.prisma.coach.findUnique({ where: { email } });
    if (!coach) {
      return;
    }
    const frontendUrl = coach.frontendUrl ?? requestOrigin;
    if (!frontendUrl) {
      this.logger.warn(
        `Cannot send password reset for coach ${coach.id}: no frontendUrl and no request origin to build a link from`,
      );
      return;
    }
    const token = this.tokenService.signPasswordResetToken(coach.id);
    await this.passwordResetEmailService.sendReset(
      coach.email,
      coach.name,
      frontendUrl,
      token,
    );
    this.logger.log(`Password reset requested for ${coach.email}`);
  }

  /**
   * Public: verifies the reset token, sets the new password, and revokes
   * every session issued before now (the same lever as the ADMIN "revoke
   * sessions" action -- a password reset is exactly the moment an old,
   * possibly-compromised session should stop working too). Returns an
   * access token, same shape as login(), so the frontend can log the coach
   * straight back in.
   */
  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ accessToken: string; coach: Coach }> {
    const coachId = this.tokenService.verifyPasswordResetToken(dto.token);
    const coach = await this.prisma.coach.findUnique({
      where: { id: coachId },
    });
    if (!coach) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }
    const passwordHash = await this.passwordService.hash(dto.newPassword);
    // One second in the past, not "now": the access token signed just below
    // gets an `iat` floored to the current second, and JwtAuthGuard rejects
    // a token whose `iat*1000 < sessionsRevokedAt`. Setting this to exactly
    // "now" risks that same-second token being born already "revoked". Any
    // real prior session's `iat` is comfortably further in the past than
    // this one-second buffer.
    const sessionsRevokedAt = new Date(Date.now() - 1000);
    const updated = await this.prisma.coach.update({
      where: { id: coach.id },
      data: { passwordHash, sessionsRevokedAt },
    });
    this.logger.log(
      `Password reset for coach ${updated.id} (${updated.email})`,
    );
    const accessToken = this.tokenService.sign({
      sub: updated.id,
      email: updated.email,
      role: updated.role,
    });
    return { accessToken, coach: updated };
  }
}
