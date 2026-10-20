import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../config/configuration.js';
import type { CoachRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: CoachRole;
  /** Set by jsonwebtoken itself on sign, read back on verify -- used to check
   * the token against Coach.sessionsRevokedAt (see JwtAuthGuard). */
  iat?: number;
}

const TOKEN_TTL = '30d';
const GOOGLE_CONNECT_STATE_TTL = '5m';
const GOOGLE_CONNECT_STATE_PURPOSE = 'google-connect';
// Long enough that a coach who doesn't check email immediately isn't
// locked out, short enough that a stale, unused invite doesn't stay a
// standing way into the account indefinitely.
const COACH_INVITE_TTL = '7d';
const COACH_INVITE_PURPOSE = 'coach-invite';

interface GoogleConnectStatePayload {
  sub: string;
  purpose: typeof GOOGLE_CONNECT_STATE_PURPOSE;
}

export interface CoachInvitePayload {
  email: string;
  name: string;
}

interface CoachInviteTokenPayload extends CoachInvitePayload {
  purpose: typeof COACH_INVITE_PURPOSE;
}

@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: AccessTokenPayload): string {
    const { jwtSecret } = this.configService.get<AppConfig>('app')!;
    return jwt.sign(payload, jwtSecret, { expiresIn: TOKEN_TTL });
  }

  verify(token: string): AccessTokenPayload {
    const { jwtSecret } = this.configService.get<AppConfig>('app')!;
    try {
      return jwt.verify(token, jwtSecret) as unknown as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Short-lived, purpose-scoped token used to prove that the Google OAuth
  // connect/callback round trip (which can't carry an Authorization header,
  // since it's a full-page browser navigation through Google's consent
  // screen) was actually initiated by an authenticated coach, not by
  // anyone who stumbles onto or directly constructs the connect/callback
  // URLs. Carries the initiating coachId -- this is how /callback knows
  // which coach's GoogleIntegration row to upsert.
  signGoogleConnectState(coachId: string): string {
    const { jwtSecret } = this.configService.get<AppConfig>('app')!;
    const payload: GoogleConnectStatePayload = {
      sub: coachId,
      purpose: GOOGLE_CONNECT_STATE_PURPOSE,
    };
    return jwt.sign(payload, jwtSecret, {
      expiresIn: GOOGLE_CONNECT_STATE_TTL,
    });
  }

  /** Returns the coachId carried in the token (see signGoogleConnectState). */
  verifyGoogleConnectState(token: string): string {
    const { jwtSecret } = this.configService.get<AppConfig>('app')!;
    let payload: GoogleConnectStatePayload;
    try {
      payload = jwt.verify(
        token,
        jwtSecret,
      ) as unknown as GoogleConnectStatePayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired connect link');
    }
    if (payload.purpose !== GOOGLE_CONNECT_STATE_PURPOSE) {
      throw new UnauthorizedException('Invalid or expired connect link');
    }
    return payload.sub;
  }

  // Carries the would-be coach's own email+name -- there is no Coach row
  // yet at invite time (see CoachesService.invite()); the Coach only comes
  // into existence once this token is redeemed via acceptInvite(), which is
  // what makes email+name+password always land together, atomically. Same
  // signed, purpose-scoped pattern as the Google connect state above.
  signCoachInviteToken(payload: CoachInvitePayload): string {
    const { jwtSecret } = this.configService.get<AppConfig>('app')!;
    const tokenPayload: CoachInviteTokenPayload = {
      ...payload,
      purpose: COACH_INVITE_PURPOSE,
    };
    return jwt.sign(tokenPayload, jwtSecret, { expiresIn: COACH_INVITE_TTL });
  }

  /** Returns the email+name carried in the token (see signCoachInviteToken). */
  verifyCoachInviteToken(token: string): CoachInvitePayload {
    const { jwtSecret } = this.configService.get<AppConfig>('app')!;
    let payload: CoachInviteTokenPayload;
    try {
      payload = jwt.verify(
        token,
        jwtSecret,
      ) as unknown as CoachInviteTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired invite link');
    }
    if (payload.purpose !== COACH_INVITE_PURPOSE) {
      throw new UnauthorizedException('Invalid or expired invite link');
    }
    return { email: payload.email, name: payload.name };
  }
}
