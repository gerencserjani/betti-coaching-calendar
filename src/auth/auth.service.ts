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
   *
   * The reset token itself has no separate "used" flag -- unlike an invite
   * token (naturally single-use, since redeeming it is what creates the
   * Coach a replay would then fail to find again), this coach already
   * exists both before and after, so nothing stops it being replayed
   * otherwise. Instead, this reuses `sessionsRevokedAt` -- the same field
   * this method itself bumps on every successful reset -- as the "used"
   * marker: a token issued before the coach's current `sessionsRevokedAt`
   * is rejected, exactly like JwtAuthGuard already does for access tokens.
   */
  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ accessToken: string; coach: Coach }> {
    const { coachId, iat } = this.tokenService.verifyPasswordResetToken(
      dto.token,
    );
    const coach = await this.prisma.coach.findUnique({
      where: { id: coachId },
    });
    if (!coach) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }
    if (
      coach.sessionsRevokedAt &&
      iat * 1000 < coach.sessionsRevokedAt.getTime()
    ) {
      throw new UnauthorizedException('This reset link has already been used');
    }
    const passwordHash = await this.passwordService.hash(dto.newPassword);
    const sessionsRevokedAt = new Date();
    const updated = await this.prisma.coach.update({
      where: { id: coach.id },
      data: { passwordHash, sessionsRevokedAt },
    });
    this.logger.log(
      `Password reset for coach ${updated.id} (${updated.email})`,
    );
    // JwtAuthGuard rejects a token whose `iat*1000 < sessionsRevokedAt`, and
    // jwt `iat` only has whole-second resolution -- a token signed "now"
    // (the default) could land in the SAME second as sessionsRevokedAt
    // above, which is ambiguous: it would make this fresh token (correctly
    // meant to survive) indistinguishable from a stale one issued earlier
    // in that same second (correctly meant to be revoked). Pinning `iat`
    // to one full second past sessionsRevokedAt's own second resolves the
    // ambiguity in both directions: this token always clears the check,
    // and anything issued in or before sessionsRevokedAt's second doesn't.
    const accessToken = this.tokenService.sign({
      sub: updated.id,
      email: updated.email,
      role: updated.role,
      iat: Math.floor(sessionsRevokedAt.getTime() / 1000) + 1,
    });
    return { accessToken, coach: updated };
  }
}
