import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { LocationType, type Coach, type EventType } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service.js';
import { I18nService } from '../i18n/i18n.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  createFullWeekAvailability,
  createTestCoach,
  createTestEventType,
} from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { SlotsService } from './slots.service.js';

/** Next date (strictly after `from`) that falls on the given ISO weekday (1=Monday..7=Sunday). */
function nextWeekday(from: DateTime, weekday: number): DateTime {
  const diff = (weekday - from.weekday + 7) % 7;
  return from.plus({ days: diff === 0 ? 7 : diff });
}

describe('SlotsService (integration)', () => {
  const prisma = testPrisma as unknown as PrismaService;
  const availabilityService = new AvailabilityService(prisma);
  const settingsService = new SettingsService(prisma);
  const i18nService = new I18nService();
  const service = new SlotsService(
    prisma,
    availabilityService,
    settingsService,
    i18nService,
  );

  let coach: Coach;
  let eventType: EventType;

  // A Thursday comfortably in the future (10 days out safely clears the
  // default 48h cancellationNoticeHours), computed at test-run time rather
  // than hardcoded -- a fixed calendar date like the old '2026-10-01'
  // literal silently goes stale and starts returning zero slots once real
  // time catches up to (or passes) it. The UTC offset in assertions is
  // derived from the Europe/Budapest zone via luxon too, so this keeps
  // working whether the computed date lands in CEST or CET.
  const FUTURE_THURSDAY = nextWeekday(
    DateTime.now().setZone('Europe/Budapest').plus({ days: 10 }),
    4,
  ).startOf('day');
  const FUTURE_DATE = FUTURE_THURSDAY.toISODate()!;
  const FUTURE_FRIDAY_DATE = FUTURE_THURSDAY.plus({ days: 1 }).toISODate()!;

  function atLocalTime(hour: number, minute = 0): DateTime {
    return FUTURE_THURSDAY.set({ hour, minute, second: 0, millisecond: 0 });
  }

  beforeAll(async () => {
    await i18nService.onModuleInit();
  });

  beforeEach(async () => {
    await resetDatabase();
    coach = await createTestCoach();
    eventType = await createTestEventType(coach.id, { durationMinutes: 30 });
    await testPrisma.weeklyAvailability.create({
      data: {
        coachId: coach.id,
        weekday: 4, // Thursday -- matches FUTURE_THURSDAY above.
        startMinute: 9 * 60,
        endMinute: 10 * 60,
      }, // 09:00-10:00
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it('slices a 1-hour window into 30-minute slots', async () => {
    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from: FUTURE_DATE,
      to: FUTURE_DATE,
    });

    expect(slots).toHaveLength(2);
    expect(slots[0].startAt).toBe(atLocalTime(9).toUTC().toISO());
    expect(slots[1].startAt).toBe(atLocalTime(9, 30).toUTC().toISO());
    expect(slots.every((s) => s.coachId === coach.id)).toBe(true);
  });

  it('excludes a slot that overlaps an existing confirmed booking', async () => {
    await testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: atLocalTime(9).toJSDate(),
        endAt: atLocalTime(9, 30).toJSDate(),
        location: LocationType.PHONE,
        clientName: 'Existing client',
        clientEmail: 'existing@example.com',
        clientPhone: '+36301234567',
        manageToken: 'existing-booking-token',
      },
    });

    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from: FUTURE_DATE,
      to: FUTURE_DATE,
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].startAt).toBe(atLocalTime(9, 30).toUTC().toISO());
  });

  it('does not treat a booking as a conflict with itself when excludeBookingId matches', async () => {
    const booking = await testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: atLocalTime(9).toJSDate(),
        endAt: atLocalTime(9, 30).toJSDate(),
        location: LocationType.PHONE,
        clientName: 'Rescheduling client',
        clientEmail: 'rescheduling@example.com',
        clientPhone: '+36301234567',
        manageToken: 'rescheduling-booking-token',
      },
    });

    const withoutExclude = await service.computeSlots({
      eventTypeId: eventType.id,
      from: FUTURE_DATE,
      to: FUTURE_DATE,
    });
    expect(withoutExclude).toHaveLength(1);

    const withExclude = await service.computeSlots({
      eventTypeId: eventType.id,
      from: FUTURE_DATE,
      to: FUTURE_DATE,
      excludeBookingId: booking.id,
    });
    expect(withExclude).toHaveLength(2);
    expect(withExclude.map((s) => s.startAt)).toContain(
      atLocalTime(9).toUTC().toISO(),
    );
  });

  it('does not exclude a slot from a CANCELLED booking at the same time', async () => {
    await testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: atLocalTime(9).toJSDate(),
        endAt: atLocalTime(9, 30).toJSDate(),
        location: LocationType.PHONE,
        clientName: 'Cancelled client',
        clientEmail: 'cancelled@example.com',
        clientPhone: '+36301234567',
        manageToken: 'cancelled-booking-token',
        status: 'CANCELLED',
      },
    });

    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from: FUTURE_DATE,
      to: FUTURE_DATE,
    });
    expect(slots).toHaveLength(2);
  });

  it('excludes slots inside the notice window, using settings.cancellationNoticeHours rather than a hardcoded value', async () => {
    await settingsService.update(coach.tenantId, {
      cancellationNoticeHours: 2,
    });
    await createFullWeekAvailability(coach.id);

    const from = DateTime.now().toISODate()!;
    const to = DateTime.now().plus({ days: 1 }).toISODate()!;
    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from,
      to,
    });

    const cutoff = DateTime.now().plus({ hours: 2 });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => DateTime.fromISO(s.startAt) >= cutoff)).toBe(
      true,
    );
  });

  it('returns no slots for a day the coach has no availability on', async () => {
    // FUTURE_FRIDAY_DATE is the day after FUTURE_THURSDAY -- no weekly row
    // was created for it.
    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from: FUTURE_FRIDAY_DATE,
      to: FUTURE_FRIDAY_DATE,
    });
    expect(slots).toEqual([]);
  });

  it('throws NotFoundException for an unknown event type', async () => {
    await expect(
      service.computeSlots({
        eventTypeId: 'does-not-exist',
        from: FUTURE_DATE,
        to: FUTURE_DATE,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException for an archived (inactive) event type', async () => {
    const archived = await createTestEventType(coach.id, { isActive: false });
    await expect(
      service.computeSlots({
        eventTypeId: archived.id,
        from: FUTURE_DATE,
        to: FUTURE_DATE,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an inverted date range', async () => {
    await expect(
      service.computeSlots({
        eventTypeId: eventType.id,
        from: FUTURE_THURSDAY.plus({ days: 4 }).toISODate()!,
        to: FUTURE_DATE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a range longer than 90 days', async () => {
    await expect(
      service.computeSlots({
        eventTypeId: eventType.id,
        from: FUTURE_DATE,
        to: FUTURE_THURSDAY.plus({ days: 123 }).toISODate()!,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
