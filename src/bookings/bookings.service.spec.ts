import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import {
  CoachRole,
  LocationType,
  type Coach,
  type EventType,
} from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service.js';
import type {
  GoogleCalendarService,
  MeetEventResult,
} from '../google/google-calendar.service.js';
import { I18nService } from '../i18n/i18n.service.js';
import type { NotificationJobsService } from '../jobs/notification-jobs.service.js';
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
import { BookingsService } from './bookings.service.js';

function fakeGoogleCalendarService(): jest.Mocked<GoogleCalendarService> {
  return {
    createMeetEvent: jest
      .fn<() => Promise<MeetEventResult>>()
      .mockResolvedValue({
        eventId: 'fake-event-id',
        meetLink: 'https://meet.google.com/fake-link',
      }),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<GoogleCalendarService>;
}

function fakeNotificationJobsService(): jest.Mocked<NotificationJobsService> {
  return {
    enqueue: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationJobsService>;
}

describe('BookingsService (integration)', () => {
  const prisma = testPrisma as unknown as PrismaService;
  const availabilityService = new AvailabilityService(prisma);
  const settingsService = new SettingsService(prisma);
  const i18nService = new I18nService();

  let googleCalendarService: jest.Mocked<GoogleCalendarService>;
  let notificationJobsService: jest.Mocked<NotificationJobsService>;
  let service: BookingsService;
  let coach: Coach;
  let eventType: EventType;

  const FUTURE_DAY = '2026-10-01'; // Thursday, well within CEST (before Oct 25 DST switch)

  beforeAll(async () => {
    await i18nService.onModuleInit();
  });

  beforeEach(async () => {
    await resetDatabase();
    coach = await createTestCoach();
    await createFullWeekAvailability(coach.id);
    eventType = await createTestEventType(coach.id, {
      durationMinutes: 30,
      locations: [LocationType.PHONE, LocationType.GOOGLE_MEET],
    });

    googleCalendarService = fakeGoogleCalendarService();
    notificationJobsService = fakeNotificationJobsService();
    service = new BookingsService(
      prisma,
      availabilityService,
      settingsService,
      googleCalendarService,
      notificationJobsService,
      i18nService,
    );
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  function createDto(
    overrides: Partial<Parameters<BookingsService['create']>[0]> = {},
  ) {
    return {
      eventTypeId: eventType.id,
      startAt: `${FUTURE_DAY}T10:00:00+02:00`,
      location: LocationType.PHONE,
      clientName: 'Test Client',
      clientEmail: 'client@example.com',
      clientPhone: '+36301234567',
      locale: 'en',
      ...overrides,
    };
  }

  describe('create', () => {
    it('creates a CONFIRMED booking and enqueues a confirmation notification', async () => {
      const booking = await service.create(createDto());

      expect(booking.status).toBe('CONFIRMED');
      expect(booking.coachId).toBe(coach.id);
      expect(booking.manageToken).toBeTruthy();
      expect(notificationJobsService.enqueue).toHaveBeenCalledWith(
        booking.id,
        'confirmed',
      );
    });

    it('generates a Google Meet link for a GOOGLE_MEET booking', async () => {
      const booking = await service.create(
        createDto({ location: LocationType.GOOGLE_MEET }),
      );

      expect(googleCalendarService.createMeetEvent).toHaveBeenCalledTimes(1);
      expect(booking.meetLink).toBe('https://meet.google.com/fake-link');
      expect(booking.googleEventId).toBe('fake-event-id');
    });

    it('rolls back the booking if Google Meet creation fails, with a message in the booking locale', async () => {
      googleCalendarService.createMeetEvent.mockRejectedValueOnce(
        new Error('Google API down'),
      );

      await expect(
        service.create(createDto({ location: LocationType.GOOGLE_MEET })),
      ).rejects.toThrow(
        'Could not create the Google Meet link, please try again.',
      );

      const bookings = await testPrisma.booking.findMany();
      expect(bookings).toHaveLength(0);
      expect(notificationJobsService.enqueue).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing event type', async () => {
      await expect(
        service.create(createDto({ eventTypeId: 'does-not-exist' })),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an archived event type', async () => {
      const archived = await createTestEventType(coach.id, { isActive: false });
      await expect(
        service.create(createDto({ eventTypeId: archived.id })),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the location is not offered by the event type', async () => {
      await expect(
        service.create(createDto({ location: LocationType.IN_PERSON })),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a time in the past', async () => {
      await expect(
        service.create(createDto({ startAt: '2020-01-01T10:00:00+01:00' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException for a slot outside the coach availability', async () => {
      const noAvailabilityCoach = await createTestCoach();
      const noAvailabilityEventType = await createTestEventType(
        noAvailabilityCoach.id,
        {
          locations: [LocationType.PHONE],
        },
      );

      await expect(
        service.create(createDto({ eventTypeId: noAvailabilityEventType.id })),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException for a slot that overlaps an existing confirmed booking', async () => {
      await service.create(createDto());
      await expect(service.create(createDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows exactly one booking to succeed when two clients race for the same slot', async () => {
      const results = await Promise.allSettled([
        service.create(createDto()),
        service.create(createDto()),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const bookings = await testPrisma.booking.findMany({
        where: { status: 'CONFIRMED' },
      });
      expect(bookings).toHaveLength(1);
    });
  });

  describe('cancelByClient', () => {
    async function createConfirmedBooking(startAt: Date) {
      const endAt = new Date(
        startAt.getTime() + eventType.durationMinutes * 60_000,
      );
      return testPrisma.booking.create({
        data: {
          eventTypeId: eventType.id,
          coachId: coach.id,
          startAt,
          endAt,
          location: LocationType.PHONE,
          clientName: 'Test Client',
          clientEmail: 'client@example.com',
          clientPhone: '+36301234567',
          manageToken: `token-${startAt.getTime()}`,
        },
        include: { eventType: true, coach: true },
      });
    }

    it('cancels a booking well outside the notice window', async () => {
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const booking = await createConfirmedBooking(farFuture);

      const cancelled = await service.cancelByClient(booking.manageToken, {
        reason: 'change of plans',
      });

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledBy).toBe('CLIENT');
      expect(notificationJobsService.enqueue).toHaveBeenCalledWith(
        booking.id,
        'cancelled',
      );
    });

    it('deletes the Google Calendar event when cancelling a GOOGLE_MEET booking', async () => {
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const booking = await testPrisma.booking.create({
        data: {
          eventTypeId: eventType.id,
          coachId: coach.id,
          startAt: farFuture,
          endAt: new Date(
            farFuture.getTime() + eventType.durationMinutes * 60_000,
          ),
          location: LocationType.GOOGLE_MEET,
          clientName: 'Test Client',
          clientEmail: 'client@example.com',
          clientPhone: '+36301234567',
          manageToken: 'meet-booking-token',
          meetLink: 'https://meet.google.com/existing',
          googleEventId: 'existing-event-id',
        },
        include: { eventType: true, coach: true },
      });

      await service.cancelByClient(booking.manageToken, {});
      expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith(
        'existing-event-id',
      );
    });

    it('rejects cancelling within the notice window, with a Hungarian message for the booking default locale', async () => {
      const soon = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now (< 48h default)
      const booking = await createConfirmedBooking(soon);

      await expect(
        service.cancelByClient(booking.manageToken, {}),
      ).rejects.toThrow(
        'Ez a foglalás már csak legalább 48 órával az időpont előtt módosítható vagy mondható le.',
      );
    });

    it('rejects cancelling an already-cancelled booking', async () => {
      const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const booking = await createConfirmedBooking(farFuture);
      await service.cancelByClient(booking.manageToken, {});

      await expect(
        service.cancelByClient(booking.manageToken, {}),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown manage token', async () => {
      await expect(
        service.cancelByClient('does-not-exist', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelByCoach', () => {
    it('lets the owning coach cancel their booking', async () => {
      const booking = await service.create(createDto());
      const cancelled = await service.cancelByCoach(coach, booking.id, {
        reason: 'coach unavailable',
      });

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledBy).toBe('COACH');
    });

    it('lets an admin cancel any coach booking', async () => {
      const booking = await service.create(createDto());
      const admin = await createTestCoach({ role: CoachRole.ADMIN });

      const cancelled = await service.cancelByCoach(admin, booking.id, {
        reason: 'admin override',
      });
      expect(cancelled.status).toBe('CANCELLED');
    });

    it("throws NotFoundException when a coach tries to cancel another coach's booking", async () => {
      const booking = await service.create(createDto());
      const otherCoach = await createTestCoach();

      await expect(
        service.cancelByCoach(otherCoach, booking.id, { reason: 'not mine' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rescheduleByClient', () => {
    it('moves a booking to a new time on the same day', async () => {
      const booking = await service.create(createDto());

      const rescheduled = await service.rescheduleByClient(
        booking.manageToken,
        {
          startAt: `${FUTURE_DAY}T14:00:00+02:00`,
        },
      );

      expect(rescheduled.startAt.toISOString()).toBe(
        '2026-10-01T12:00:00.000Z',
      );
      expect(notificationJobsService.enqueue).toHaveBeenCalledWith(
        booking.id,
        'rescheduled',
      );
    });

    it('regenerates the Google Meet link when rescheduling a GOOGLE_MEET booking', async () => {
      const booking = await service.create(
        createDto({ location: LocationType.GOOGLE_MEET }),
      );
      googleCalendarService.createMeetEvent.mockResolvedValueOnce({
        eventId: 'new-event-id',
        meetLink: 'https://meet.google.com/new-link',
      });

      const rescheduled = await service.rescheduleByClient(
        booking.manageToken,
        {
          startAt: `${FUTURE_DAY}T15:00:00+02:00`,
        },
      );

      expect(googleCalendarService.deleteEvent).toHaveBeenCalledWith(
        'fake-event-id',
      );
      expect(rescheduled.meetLink).toBe('https://meet.google.com/new-link');
      expect(rescheduled.googleEventId).toBe('new-event-id');
    });

    it('rejects rescheduling onto a slot that is already booked', async () => {
      const first = await service.create(createDto());
      const second = await service.create(
        createDto({ startAt: `${FUTURE_DAY}T14:00:00+02:00` }),
      );

      await expect(
        service.rescheduleByClient(second.manageToken, {
          startAt: `${FUTURE_DAY}T10:00:00+02:00`,
        }),
      ).rejects.toThrow(ConflictException);

      // Original booking is untouched.
      const stillThere = await testPrisma.booking.findUnique({
        where: { id: first.id },
      });
      expect(stillThere?.startAt.toISOString()).toBe(
        '2026-10-01T08:00:00.000Z',
      );
    });

    it('rejects rescheduling within the notice window', async () => {
      const booking = await service.create(createDto());
      await testPrisma.booking.update({
        where: { id: booking.id },
        data: { startAt: new Date(Date.now() + 60 * 60 * 1000) },
      });

      await expect(
        service.rescheduleByClient(booking.manageToken, {
          startAt: `${FUTURE_DAY}T16:00:00+02:00`,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
