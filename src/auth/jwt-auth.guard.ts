import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = this.tokenService.verify(token);
    const coach = await this.prisma.coach.findUnique({
      where: { id: payload.sub },
    });
    if (!coach) {
      throw new UnauthorizedException('Account no longer exists');
    }
    // Tokens have no other revocation path (30-day TTL, no refresh/session
    // store) -- this is what makes an admin's "revoke sessions" action for
    // a coach actually take effect immediately instead of up to 30 days later.
    if (
      coach.sessionsRevokedAt &&
      payload.iat !== undefined &&
      payload.iat * 1000 < coach.sessionsRevokedAt.getTime()
    ) {
      throw new UnauthorizedException(
        'Session has been revoked, please log in again',
      );
    }

    request.coach = coach;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length);
  }
}
