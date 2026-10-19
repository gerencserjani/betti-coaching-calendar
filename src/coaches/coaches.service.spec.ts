import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoachRole } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestCoach, createTestTenant } from '../test/factories.js';
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
    it("creates a coach with the COACH role, a hashed password, and the actor's tenant", async () => {
      const admin = await createTestCoach({ role: CoachRole.ADMIN });
      const coach = await service.create(admin, {
        email: 'new@example.com',
        name: 'New Coach',
        password: 'a-real-password',
      });
      expect(coach.role).toBe(CoachRole.COACH);
      expect(coach.tenantId).toBe(admin.tenantId);
      expect(coach.passwordHash).not.toBe('a-real-password');
      expect(coach.passwordHash.length).toBeGreaterThan(20);
    });

    it('rejects creating a second coach with the same email', async () => {
      const admin = await createTestCoach({ role: CoachRole.ADMIN });
      await service.create(admin, {
        email: 'dup@example.com',
        name: 'First',
        password: 'password-123',
      });
      await expect(
        service.create(admin, {
          email: 'dup@example.com',
          name: 'Second',
          password: 'password-456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('scopes a non-admin caller to their own tenant', async () => {
      const tenant = await createTestTenant();
      await createTestCoach({ name: 'Zoltán', tenantId: tenant.id });
      const caller = await createTestCoach({
        name: 'Anna',
        tenantId: tenant.id,
      });
      await createTestCoach({ name: 'Different Tenant Coach' });

      const all = await service.findAll(caller);
      expect(all.map((c) => c.name).sort()).toEqual(['Anna', 'Zoltán']);
    });

    it('returns every coach across every tenant for an ADMIN caller', async () => {
      const admin = await createTestCoach({ role: CoachRole.ADMIN });
      await createTestCoach({ name: 'Tenant A Coach' });
      await createTestCoach({ name: 'Tenant B Coach' });

      const all = await service.findAll(admin);
      expect(all.length).toBe(3);
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
    it('lets an ADMIN revoke any coach, regardless of tenant', async () => {
      const admin = await createTestCoach({ role: CoachRole.ADMIN });
      const coach = await createTestCoach();
      expect(coach.sessionsRevokedAt).toBeNull();

      const before = new Date();
      const revoked = await service.revokeSessions(admin, coach.id);
      expect(revoked.sessionsRevokedAt).not.toBeNull();
      expect(revoked.sessionsRevokedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });

    it('lets an OWNER revoke a plain COACH within their own tenant', async () => {
      const tenant = await createTestTenant();
      const owner = await createTestCoach({
        role: CoachRole.OWNER,
        tenantId: tenant.id,
      });
      const coach = await createTestCoach({ tenantId: tenant.id });

      const revoked = await service.revokeSessions(owner, coach.id);
      expect(revoked.sessionsRevokedAt).not.toBeNull();
    });

    it('rejects an OWNER revoking a coach in a different tenant', async () => {
      const owner = await createTestCoach({ role: CoachRole.OWNER });
      const coach = await createTestCoach();

      await expect(service.revokeSessions(owner, coach.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an OWNER revoking another OWNER, even in the same tenant', async () => {
      const tenant = await createTestTenant();
      const owner = await createTestCoach({
        role: CoachRole.OWNER,
        tenantId: tenant.id,
      });
      const otherOwner = await createTestCoach({
        role: CoachRole.OWNER,
        tenantId: tenant.id,
      });

      await expect(
        service.revokeSessions(owner, otherOwner.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
