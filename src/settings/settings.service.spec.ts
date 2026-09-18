import type { PrismaService } from '../prisma/prisma.service.js';
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

  it('creates the singleton row with sensible defaults on first get()', async () => {
    const settings = await service.get();
    expect(settings.id).toBe('singleton');
    expect(settings.cancellationNoticeHours).toBe(48);
    expect(settings.businessTimezone).toBe('Europe/Budapest');
  });

  it('get() is idempotent - a second call returns the same row, not a duplicate', async () => {
    const first = await service.get();
    const second = await service.get();
    expect(second.id).toBe(first.id);
    expect(await testPrisma.settings.count()).toBe(1);
  });

  it('update() persists changes and returns them', async () => {
    await service.get();
    const updated = await service.update({
      cancellationNoticeHours: 24,
      businessAddress: 'Szeged, Fő tér 1.',
    });
    expect(updated.cancellationNoticeHours).toBe(24);
    expect(updated.businessAddress).toBe('Szeged, Fő tér 1.');

    const reread = await service.get();
    expect(reread.cancellationNoticeHours).toBe(24);
  });

  it('update() works even if get() was never called first (creates then updates)', async () => {
    const updated = await service.update({ cancellationNoticeHours: 12 });
    expect(updated.cancellationNoticeHours).toBe(12);
  });
});
