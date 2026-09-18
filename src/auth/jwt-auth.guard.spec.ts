import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CoachRole, type Coach } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestCoach } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TokenService } from './token.service.js';

function fakeConfigService(): ConfigService {
  return {
    get: () => ({ jwtSecret: 'jwt-guard-test-secret-32-chars-minimum' }),
  } as unknown as ConfigService;
}

function contextWithAuthHeader(authorization?: string): ExecutionContext {
  const request = { headers: { authorization } } as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (integration)', () => {
  const tokenService = new TokenService(fakeConfigService());
  const guard = new JwtAuthGuard(
    tokenService,
    testPrisma as unknown as PrismaService,
  );
  let coach: Coach;

  beforeEach(async () => {
    await resetDatabase();
    coach = await createTestCoach({ role: CoachRole.COACH });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it('rejects a request with no Authorization header', async () => {
    await expect(
      guard.canActivate(contextWithAuthHeader(undefined)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    await expect(
      guard.canActivate(contextWithAuthHeader('Basic abc123')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a syntactically invalid token', async () => {
    await expect(
      guard.canActivate(contextWithAuthHeader('Bearer not-a-jwt')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token for an existing coach and attaches it to the request', async () => {
    const token = tokenService.sign({
      sub: coach.id,
      email: coach.email,
      role: coach.role,
    });
    const request = {
      headers: { authorization: `Bearer ${token}` },
    } as Request;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.coach?.id).toBe(coach.id);
  });

  it('rejects a token for a coach that no longer exists', async () => {
    const token = tokenService.sign({
      sub: 'deleted-coach-id',
      email: 'gone@example.com',
      role: CoachRole.COACH,
    });
    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a token issued before the coach's sessions were revoked", async () => {
    const token = tokenService.sign({
      sub: coach.id,
      email: coach.email,
      role: coach.role,
    });
    // Simulate revocation happening after the token was issued: back-date it
    // by a couple of seconds so this doesn't depend on real clock timing.
    await testPrisma.coach.update({
      where: { id: coach.id },
      data: { sessionsRevokedAt: new Date(Date.now() + 2000) },
    });

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a token issued after the recorded revocation time', async () => {
    await testPrisma.coach.update({
      where: { id: coach.id },
      data: { sessionsRevokedAt: new Date(Date.now() - 2000) },
    });
    const token = tokenService.sign({
      sub: coach.id,
      email: coach.email,
      role: coach.role,
    });

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`)),
    ).resolves.toBe(true);
  });
});
