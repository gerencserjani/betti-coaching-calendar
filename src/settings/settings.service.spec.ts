import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestTenant } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { SettingsService } from './settings.service.js';

describe('SettingsService (integration)', () => {
  const service = new SettingsService(testPrisma as unknown as PrismaService);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it("creates the tenant's row with sensible defaults on first get()", async () => {
    const tenant = await createTestTenant();
    const settings = await service.get(tenant.id);
    expect(settings.tenantId).toBe(tenant.id);
    expect(settings.cancellationNoticeHours).toBe(48);
    expect(settings.businessTimezone).toBe('Europe/Budapest');
  });

  it('get() is idempotent - a second call returns the same row, not a duplicate', async () => {
    const tenant = await createTestTenant();
    const first = await service.get(tenant.id);
    const second = await service.get(tenant.id);
    expect(second.tenantId).toBe(first.tenantId);
    expect(await testPrisma.settings.count()).toBe(1);
  });

  it('update() persists changes and returns them, scoped to the given tenant', async () => {
    const tenant = await createTestTenant();
    await service.get(tenant.id);
    const updated = await service.update(tenant.id, {
      cancellationNoticeHours: 24,
      businessAddress: 'Szeged, Fő tér 1.',
    });
    expect(updated.cancellationNoticeHours).toBe(24);
    expect(updated.businessAddress).toBe('Szeged, Fő tér 1.');

    const reread = await service.get(tenant.id);
    expect(reread.cancellationNoticeHours).toBe(24);
  });

  it('update() works even if get() was never called first (creates then updates)', async () => {
    const tenant = await createTestTenant();
    const updated = await service.update(tenant.id, {
      cancellationNoticeHours: 12,
    });
    expect(updated.cancellationNoticeHours).toBe(12);
  });

  it("keeps each tenant's settings independent", async () => {
    const tenantA = await createTestTenant();
    const tenantB = await createTestTenant();
    await service.update(tenantA.id, { cancellationNoticeHours: 10 });
    await service.update(tenantB.id, { cancellationNoticeHours: 20 });

    expect((await service.get(tenantA.id)).cancellationNoticeHours).toBe(10);
    expect((await service.get(tenantB.id)).cancellationNoticeHours).toBe(20);
  });

  describe('getForPublicRequest', () => {
    it('returns the first (and, today, only) tenant', async () => {
      const tenant = await createTestTenant();
      const settings = await service.getForPublicRequest();
      expect(settings.tenantId).toBe(tenant.id);
    });

    it('throws when no tenant exists at all', async () => {
      await expect(service.getForPublicRequest()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
