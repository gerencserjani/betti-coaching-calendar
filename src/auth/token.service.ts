import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../config/configuration.js';
import type { CoachRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: CoachRole;
}

const TOKEN_TTL = '30d';

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
}
