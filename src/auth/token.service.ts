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

interface GoogleConnectStatePayload {
  sub: string;
  purpose: typeof GOOGLE_CONNECT_STATE_PURPOSE;
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
  // screen) was actually initiated by an authenticated admin, not by anyone
  // who stumbles onto or directly constructs the connect/callback URLs.
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

  verifyGoogleConnectState(token: string): void {
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
  }
}
