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

  beforeAll(async () => {
    await i18nService.onModuleInit();
  });

  beforeEach(async () => {
    await resetDatabase();
    coach = await createTestCoach();
    eventType = await createTestEventType(coach.id, { durationMinutes: 30 });
    // Thursday 2026-10-01 is comfortably in the future relative to "now" in
    // any timezone this test suite might run in.
    await testPrisma.weeklyAvailability.create({
      data: {
        coachId: coach.id,
        weekday: 4,
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
      from: '2026-10-01',
      to: '2026-10-01',
    });

    expect(slots).toHaveLength(2);
    expect(slots[0].startAt).toBe('2026-10-01T07:00:00.000Z'); // 09:00 Europe/Budapest (CEST, UTC+2)
    expect(slots[1].startAt).toBe('2026-10-01T07:30:00.000Z');
    expect(slots.every((s) => s.coachId === coach.id)).toBe(true);
  });

  it('excludes a slot that overlaps an existing confirmed booking', async () => {
    await testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: new Date('2026-10-01T07:00:00.000Z'),
        endAt: new Date('2026-10-01T07:30:00.000Z'),
        location: LocationType.PHONE,
        clientName: 'Existing client',
        clientEmail: 'existing@example.com',
        clientPhone: '+36301234567',
        manageToken: 'existing-booking-token',
      },
    });

    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from: '2026-10-01',
      to: '2026-10-01',
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].startAt).toBe('2026-10-01T07:30:00.000Z');
  });

  it('does not exclude a slot from a CANCELLED booking at the same time', async () => {
    await testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: new Date('2026-10-01T07:00:00.000Z'),
        endAt: new Date('2026-10-01T07:30:00.000Z'),
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
      from: '2026-10-01',
      to: '2026-10-01',
    });
    expect(slots).toHaveLength(2);
  });

  it('excludes slots inside the notice window, using settings.cancellationNoticeHours rather than a hardcoded value', async () => {
    await settingsService.update({ cancellationNoticeHours: 2 });
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
    // 2026-10-02 is a Friday - no weekly row was created for it.
    const slots = await service.computeSlots({
      eventTypeId: eventType.id,
      from: '2026-10-02',
      to: '2026-10-02',
    });
    expect(slots).toEqual([]);
  });

  it('throws NotFoundException for an unknown event type', async () => {
    await expect(
      service.computeSlots({
        eventTypeId: 'does-not-exist',
        from: '2026-10-01',
        to: '2026-10-01',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException for an archived (inactive) event type', async () => {
    const archived = await createTestEventType(coach.id, { isActive: false });
    await expect(
      service.computeSlots({
        eventTypeId: archived.id,
        from: '2026-10-01',
        to: '2026-10-01',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects an inverted date range', async () => {
    await expect(
      service.computeSlots({
        eventTypeId: eventType.id,
        from: '2026-10-05',
        to: '2026-10-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a range longer than 90 days', async () => {
    await expect(
      service.computeSlots({
        eventTypeId: eventType.id,
        from: '2026-10-01',
        to: '2027-02-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
