import { ConflictException } from '@nestjs/common';
import { CoachRole } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestCoach } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { CoachesService } from './coaches.service.js';

describe('CoachesService (integration)', () => {
  const service = new CoachesService(
    testPrisma as unknown as PrismaService,
    new PasswordService(),
  );

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  describe('create', () => {
    it('creates a coach with the COACH role and a hashed password', async () => {
      const coach = await service.create({
        email: 'new@example.com',
        name: 'New Coach',
        password: 'a-real-password',
      });
      expect(coach.role).toBe(CoachRole.COACH);
      expect(coach.passwordHash).not.toBe('a-real-password');
      expect(coach.passwordHash.length).toBeGreaterThan(20);
    });

    it('rejects creating a second coach with the same email', async () => {
      await service.create({
        email: 'dup@example.com',
        name: 'First',
        password: 'password-123',
      });
      await expect(
        service.create({
          email: 'dup@example.com',
          name: 'Second',
          password: 'password-456',
        }),
      ).rejects.toThrow(ConflictException);
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
});
