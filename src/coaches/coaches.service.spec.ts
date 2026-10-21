import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CoachRole } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import { TokenService } from '../auth/token.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestAllowedOrigin, createTestCoach } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { CoachInviteEmailService } from './coach-invite-email.service.js';
import { CoachesService } from './coaches.service.js';

function fakeConfigService(): ConfigService {
  return {
    get: () => ({ jwtSecret: 'coaches-service-test-secret-32-chars-min' }),
  } as unknown as ConfigService;
}

describe('CoachesService (integration)', () => {
  const tokenService = new TokenService(fakeConfigService());
  const sendInvite = jest.fn().mockResolvedValue(undefined);
  const fakeInviteEmailService = {
    sendInvite,
  } as unknown as CoachInviteEmailService;
  const service = new CoachesService(
    testPrisma as unknown as PrismaService,
    new PasswordService(),
    tokenService,
    fakeInviteEmailService,
  );

  beforeEach(async () => {
    await resetDatabase();
    sendInvite.mockClear();
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  describe('invite', () => {
    it('sends an invite email without creating a Coach row', async () => {
      const origin = await createTestAllowedOrigin();

      await service.invite({
        email: 'new@example.com',
        name: 'New Coach',
        frontendUrl: origin.origin,
      });

      expect(sendInvite).toHaveBeenCalledWith(
        'new@example.com',
        'New Coach',
        origin.origin,
        expect.any(String),
      );
      const coach = await testPrisma.coach.findUnique({
        where: { email: 'new@example.com' },
      });
      expect(coach).toBeNull();
    });

    it('rejects inviting an email that already belongs to a coach', async () => {
      await createTestCoach({ email: 'dup@example.com' });
      const origin = await createTestAllowedOrigin();

      await expect(
        service.invite({
          email: 'dup@example.com',
          name: 'Someone else',
          frontendUrl: origin.origin,
        }),
      ).rejects.toThrow(ConflictException);
      expect(sendInvite).not.toHaveBeenCalled();
    });

    it('rejects inviting to a site that already has a coach', async () => {
      const origin = await createTestAllowedOrigin();
      await createTestCoach({ frontendUrl: origin.origin });

      await expect(
        service.invite({
          email: 'someone@example.com',
          name: 'Someone',
          frontendUrl: origin.origin,
        }),
      ).rejects.toThrow(ConflictException);
      expect(sendInvite).not.toHaveBeenCalled();
    });

    it('rejects inviting to a site that is not an allowed origin', async () => {
      await expect(
        service.invite({
          email: 'someone@example.com',
          name: 'Someone',
          frontendUrl: 'https://not-allow-listed.example.com',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(sendInvite).not.toHaveBeenCalled();
    });
  });

  describe('acceptInvite', () => {
    it('creates the Coach with the COACH role, the invited email/name/frontendUrl, and a hashed password', async () => {
      const token = tokenService.signCoachInviteToken({
        email: 'accepted@example.com',
        name: 'Accepted Coach',
        frontendUrl: 'https://accepted-coach.example.com',
      });

      const { accessToken, coach } = await service.acceptInvite({
        token,
        password: 'a-real-password',
      });

      expect(coach.email).toBe('accepted@example.com');
      expect(coach.name).toBe('Accepted Coach');
      expect(coach.frontendUrl).toBe('https://accepted-coach.example.com');
      expect(coach.role).toBe(CoachRole.COACH);
      expect(coach.passwordHash).not.toBe('a-real-password');
      expect(coach.passwordHash.length).toBeGreaterThan(20);
      expect(tokenService.verify(accessToken).sub).toBe(coach.id);
    });

    it('rejects an invite for an email that already belongs to a coach', async () => {
      await createTestCoach({ email: 'already@example.com' });
      const token = tokenService.signCoachInviteToken({
        email: 'already@example.com',
        name: 'Already',
        frontendUrl: 'https://already.example.com',
      });

      await expect(
        service.acceptInvite({ token, password: 'a-real-password' }),
      ).rejects.toThrow(ConflictException);
    });

    // The service layer itself doesn't pre-check frontendUrl here (invite()
    // already did, at invite time) -- this is the Coach.frontendUrl @unique
    // constraint acting as the real backstop against a race between two
    // accept-invite calls for the same site. At this layer it surfaces as a
    // raw Prisma error; the global PrismaExceptionFilter (see
    // common/prisma-exception.filter.ts, exercised in the e2e suite) is
    // what turns it into a 409 over HTTP.
    it('rejects accepting if another coach already claimed this site in the meantime, without creating the Coach', async () => {
      await createTestCoach({ frontendUrl: 'https://taken.example.com' });
      const token = tokenService.signCoachInviteToken({
        email: 'late@example.com',
        name: 'Late',
        frontendUrl: 'https://taken.example.com',
      });

      await expect(
        service.acceptInvite({ token, password: 'a-real-password' }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const coach = await testPrisma.coach.findUnique({
        where: { email: 'late@example.com' },
      });
      expect(coach).toBeNull();
    });

    it('rejects an invalid or expired token', async () => {
      await expect(
        service.acceptInvite({ token: 'not-a-real-token', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findAll', () => {
    it('returns every coach, ordered by name', async () => {
      await createTestCoach({ name: 'Zoltán' });
      await createTestCoach({ name: 'Anna' });

      const all = await service.findAll();
      expect(all.map((c) => c.name)).toEqual(['Anna', 'Zoltán']);
    });
  });

  describe('update', () => {
    it('updates the given fields', async () => {
      const coach = await createTestCoach({ name: 'Old Name' });
      const updated = await service.update(coach.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });
  });

  describe('setFrontendUrl', () => {
    it('sets frontendUrl on the given coach', async () => {
      const coach = await createTestCoach();
      const origin = await createTestAllowedOrigin();

      const updated = await service.setFrontendUrl(coach.id, origin.origin);

      expect(updated.frontendUrl).toBe(origin.origin);
    });

    it('allows re-setting a coach to the site it already owns', async () => {
      const origin = await createTestAllowedOrigin();
      const coach = await createTestCoach({ frontendUrl: origin.origin });

      await expect(
        service.setFrontendUrl(coach.id, origin.origin),
      ).resolves.toMatchObject({ frontendUrl: origin.origin });
    });

    it('rejects a site that already belongs to a different coach', async () => {
      const origin = await createTestAllowedOrigin();
      await createTestCoach({ frontendUrl: origin.origin });
      const other = await createTestCoach();

      await expect(
        service.setFrontendUrl(other.id, origin.origin),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a site that is not an allowed origin', async () => {
      const coach = await createTestCoach();

      await expect(
        service.setFrontendUrl(
          coach.id,
          'https://not-allow-listed.example.com',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeSessions', () => {
    it('stamps sessionsRevokedAt with the current time', async () => {
      const coach = await createTestCoach();
      expect(coach.sessionsRevokedAt).toBeNull();

      const before = new Date();
      const revoked = await service.revokeSessions(coach.id);
      expect(revoked.sessionsRevokedAt).not.toBeNull();
      expect(revoked.sessionsRevokedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe('changePassword', () => {
    it('changes the password when the current one is correct', async () => {
      const coach = await createTestCoach({ password: 'old-password-123' });

      await service.changePassword(coach, {
        currentPassword: 'old-password-123',
        newPassword: 'new-password-456',
      });

      const updated = await testPrisma.coach.findUniqueOrThrow({
        where: { id: coach.id },
      });
      const passwordService = new PasswordService();
      await expect(
        passwordService.compare('new-password-456', updated.passwordHash),
      ).resolves.toBe(true);
      await expect(
        passwordService.compare('old-password-123', updated.passwordHash),
      ).resolves.toBe(false);
    });

    it('rejects a wrong current password without changing anything', async () => {
      const coach = await createTestCoach({ password: 'old-password-123' });

      await expect(
        service.changePassword(coach, {
          currentPassword: 'wrong-password',
          newPassword: 'new-password-456',
        }),
      ).rejects.toThrow(UnauthorizedException);

      const unchanged = await testPrisma.coach.findUniqueOrThrow({
        where: { id: coach.id },
      });
      expect(unchanged.passwordHash).toBe(coach.passwordHash);
    });
  });
});
