import type { Coach } from '@prisma/client';
import { createTestCoach } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AvailabilityService, toDateOnly } from './availability.service.js';

const TZ = 'Europe/Budapest';

describe('AvailabilityService (integration)', () => {
  const service = new AvailabilityService(
    testPrisma as unknown as PrismaService,
  );
  let coachA: Coach;

  beforeEach(async () => {
    await resetDatabase();
    coachA = await createTestCoach({ email: 'coach-a@example.com' });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  describe('getEffectiveRangesForDate', () => {
    it('falls back to the weekly schedule when there is no override for that date', async () => {
      await testPrisma.weeklyAvailability.create({
        data: {
          coachId: coachA.id,
          weekday: 1,
          startMinute: 540,
          endMinute: 1020,
        }, // Monday 09:00-17:00
      });

      // 2026-09-21 is a Monday.
      const ranges = await service.getEffectiveRangesForDate(
        coachA.id,
        '2026-09-21',
        TZ,
      );
      expect(ranges).toEqual([{ startMinute: 540, endMinute: 1020 }]);
    });

    it('prefers a date-specific override over the weekly schedule', async () => {
      await testPrisma.weeklyAvailability.create({
        data: {
          coachId: coachA.id,
          weekday: 1,
          startMinute: 540,
          endMinute: 1020,
        },
      });
      await testPrisma.availabilityOverride.create({
        data: {
          coachId: coachA.id,
          date: toDateOnly('2026-09-21'),
          startMinute: 600,
          endMinute: 660,
        },
      });

      const ranges = await service.getEffectiveRangesForDate(
        coachA.id,
        '2026-09-21',
        TZ,
      );
      expect(ranges).toEqual([{ startMinute: 600, endMinute: 660 }]);
    });

    it('returns no ranges when the override marks the day fully unavailable', async () => {
      await testPrisma.weeklyAvailability.create({
        data: {
          coachId: coachA.id,
          weekday: 1,
          startMinute: 540,
          endMinute: 1020,
        },
      });
      await testPrisma.availabilityOverride.create({
        data: {
          coachId: coachA.id,
          date: toDateOnly('2026-09-21'),
          isUnavailable: true,
        },
      });

      const ranges = await service.getEffectiveRangesForDate(
        coachA.id,
        '2026-09-21',
        TZ,
      );
      expect(ranges).toEqual([]);
    });
  });
});
