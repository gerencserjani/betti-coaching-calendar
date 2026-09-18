import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestCoach } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

function fakeConfigService(): ConfigService {
  return {
    get: () => ({ jwtSecret: 'auth-service-test-secret-32-chars-min' }),
  } as unknown as ConfigService;
}

describe('AuthService (integration)', () => {
  const passwordService = new PasswordService();
  const tokenService = new TokenService(fakeConfigService());
  const service = new AuthService(
    testPrisma as unknown as PrismaService,
    passwordService,
    tokenService,
  );

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it('logs in with the correct email/password and returns a valid access token', async () => {
    await createTestCoach({
      email: 'coach@example.com',
      password: 'the-real-password',
    });

    const { accessToken, coach } = await service.login(
      'coach@example.com',
      'the-real-password',
    );
    expect(coach.email).toBe('coach@example.com');

    const decoded = tokenService.verify(accessToken);
    expect(decoded.sub).toBe(coach.id);
  });

  it('rejects a correct email with the wrong password', async () => {
    await createTestCoach({
      email: 'coach@example.com',
      password: 'the-real-password',
    });
    await expect(
      service.login('coach@example.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an email that does not exist, with the same generic error as a wrong password', async () => {
    await expect(
      service.login('nobody@example.com', 'anything'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
