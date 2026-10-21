import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { createTestCoach } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { DEFAULT_EMAIL_PALETTE } from '../notifications/templates/BookingEmail.js';
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

  it("creates the coach's row with sensible defaults on first get()", async () => {
    const coach = await createTestCoach();
    const settings = await service.get(coach.id);
    expect(settings.coachId).toBe(coach.id);
    expect(settings.cancellationNoticeHours).toBe(48);
    expect(settings.businessTimezone).toBe('Europe/Budapest');
  });

  it('get() is idempotent - a second call returns the same row, not a duplicate', async () => {
    const coach = await createTestCoach();
    const first = await service.get(coach.id);
    const second = await service.get(coach.id);
    expect(second.coachId).toBe(first.coachId);
    expect(await testPrisma.settings.count()).toBe(1);
  });

  it('update() persists changes and returns them, scoped to the given coach', async () => {
    const coach = await createTestCoach();
    await service.get(coach.id);
    const updated = await service.update(coach.id, {
      cancellationNoticeHours: 24,
      businessAddress: 'Szeged, Fő tér 1.',
    });
    expect(updated.cancellationNoticeHours).toBe(24);
    expect(updated.businessAddress).toBe('Szeged, Fő tér 1.');

    const reread = await service.get(coach.id);
    expect(reread.cancellationNoticeHours).toBe(24);
  });

  it('update() works even if get() was never called first (creates then updates)', async () => {
    const coach = await createTestCoach();
    const updated = await service.update(coach.id, {
      cancellationNoticeHours: 12,
    });
    expect(updated.cancellationNoticeHours).toBe(12);
  });

  it("keeps each coach's settings independent", async () => {
    const coachA = await createTestCoach();
    const coachB = await createTestCoach();
    await service.update(coachA.id, { cancellationNoticeHours: 10 });
    await service.update(coachB.id, { cancellationNoticeHours: 20 });

    expect((await service.get(coachA.id)).cancellationNoticeHours).toBe(10);
    expect((await service.get(coachB.id)).cancellationNoticeHours).toBe(20);
  });

  it('throws NotFoundException for a coachId that does not exist', async () => {
    await expect(service.get('no-such-coach')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('emailBrandPalette validation', () => {
    it('accepts and persists a well-formed palette', async () => {
      const coach = await createTestCoach();
      const updated = await service.update(coach.id, {
        emailBrandPalette: DEFAULT_EMAIL_PALETTE,
      });
      expect(updated.emailBrandPalette).toEqual(DEFAULT_EMAIL_PALETTE);
    });

    it('clears a previously-set palette back to null', async () => {
      const coach = await createTestCoach();
      await service.update(coach.id, {
        emailBrandPalette: DEFAULT_EMAIL_PALETTE,
      });
      const cleared = await service.update(coach.id, {
        emailBrandPalette: null,
      });
      expect(cleared.emailBrandPalette).toBeNull();
    });

    it('rejects a palette missing required keys', async () => {
      const coach = await createTestCoach();
      const incomplete = { light: DEFAULT_EMAIL_PALETTE.light };
      await expect(
        service.update(coach.id, { emailBrandPalette: incomplete }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a palette with a non-hex color value', async () => {
      const coach = await createTestCoach();
      await expect(
        service.update(coach.id, {
          emailBrandPalette: {
            ...DEFAULT_EMAIL_PALETTE,
            light: { ...DEFAULT_EMAIL_PALETTE.light, accent: 'not-a-color' },
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
