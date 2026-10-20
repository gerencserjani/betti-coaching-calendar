import { jest } from '@jest/globals';
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
import type { PasswordResetEmailService } from './password-reset-email.service.js';
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
  const sendReset = jest.fn().mockResolvedValue(undefined);
  const fakeResetEmailService = {
    sendReset,
  } as unknown as PasswordResetEmailService;
  const service = new AuthService(
    testPrisma as unknown as PrismaService,
    passwordService,
    tokenService,
    fakeResetEmailService,
  );

  beforeEach(async () => {
    await resetDatabase();
    sendReset.mockClear();
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

  describe('forgotPassword', () => {
    it("sends a reset email to the coach's own address, using her stored frontendUrl", async () => {
      await createTestCoach({
        email: 'coach@example.com',
        name: 'Coach Name',
        frontendUrl: 'https://coach.example.com',
      });

      await service.forgotPassword('coach@example.com', null);

      expect(sendReset).toHaveBeenCalledWith(
        'coach@example.com',
        'Coach Name',
        'https://coach.example.com',
        expect.any(String),
      );
    });

    it('falls back to the request origin when the coach has no stored frontendUrl', async () => {
      await createTestCoach({ email: 'coach@example.com' });

      await service.forgotPassword(
        'coach@example.com',
        'https://request-origin.example.com',
      );

      expect(sendReset).toHaveBeenCalledWith(
        'coach@example.com',
        expect.any(String),
        'https://request-origin.example.com',
        expect.any(String),
      );
    });

    it('is silent for an email with no account, and sends nothing', async () => {
      await expect(
        service.forgotPassword('nobody@example.com', 'https://example.com'),
      ).resolves.toBeUndefined();
      expect(sendReset).not.toHaveBeenCalled();
    });

    it('sends nothing when neither a stored frontendUrl nor a request origin is available', async () => {
      await createTestCoach({ email: 'coach@example.com' });

      await service.forgotPassword('coach@example.com', null);

      expect(sendReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('sets the new password, revokes existing sessions, and returns a valid access token', async () => {
      const coach = await createTestCoach({
        email: 'coach@example.com',
        password: 'old-password-123',
      });
      const token = tokenService.signPasswordResetToken(coach.id);

      const { accessToken, coach: updated } = await service.resetPassword({
        token,
        newPassword: 'brand-new-password',
      });

      expect(updated.sessionsRevokedAt).not.toBeNull();
      expect(tokenService.verify(accessToken).sub).toBe(coach.id);

      await expect(
        service.login('coach@example.com', 'brand-new-password'),
      ).resolves.toBeDefined();
      await expect(
        service.login('coach@example.com', 'old-password-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an invalid or expired token', async () => {
      await expect(
        service.resetPassword({ token: 'not-a-real-token', newPassword: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects replaying the same reset token a second time', async () => {
      const coach = await createTestCoach({ email: 'coach@example.com' });
      const token = tokenService.signPasswordResetToken(coach.id);

      await service.resetPassword({ token, newPassword: 'first-new-password' });

      await expect(
        service.resetPassword({ token, newPassword: 'second-new-password' }),
      ).rejects.toThrow(UnauthorizedException);

      // The first reset's password is still the one in effect.
      await expect(
        service.login('coach@example.com', 'first-new-password'),
      ).resolves.toBeDefined();
    });
  });
});
