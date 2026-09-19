import { jest } from '@jest/globals';
import { LocationType } from '@prisma/client';
import type {
  GoogleCalendarService,
  MeetEventResult,
} from '../google/google-calendar.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type {
  BookingWithRelations,
  NotificationsService,
} from '../notifications/notifications.service.js';
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
import { NotificationJobsService } from './notification-jobs.service.js';
import { PgBossService } from './pgboss.service.js';

jest.setTimeout(30_000);

function fakeNotificationsService(): jest.Mocked<NotificationsService> {
  return {
    notifyBookingConfirmed: jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
    notifyBookingCancelled: jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
    notifyBookingRescheduled: jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationsService>;
}

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

async function waitFor(
  condition: () => boolean,
  timeoutMs = 15_000,
  intervalMs = 200,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (!condition()) {
    throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
  }
}

describe('NotificationJobsService (integration, real pg-boss)', () => {
  const prisma = testPrisma as unknown as PrismaService;
  const pgBossService = new PgBossService();
  // pg-boss's `work()` handler is registered once and keeps a closure over
  // this exact object for the life of the boss instance - recreating the
  // mock (and the service) per test would leave a stale worker bound to a
  // previous test's mock, silently eating jobs meant for the current one.
  // Instead, one worker is registered in beforeAll, and each test resets the
  // same mock's call history in place.
  const notificationsService = fakeNotificationsService();
  const googleCalendarService = fakeGoogleCalendarService();
  let service: NotificationJobsService;

  beforeAll(async () => {
    await pgBossService.onModuleInit();
    service = new NotificationJobsService(
      pgBossService,
      prisma,
      notificationsService,
      googleCalendarService,
    );
    await service.onModuleInit();
  });

  afterAll(async () => {
    await pgBossService.onModuleDestroy();
    await resetDatabase();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase();
    notificationsService.notifyBookingConfirmed
      .mockReset()
      .mockResolvedValue(undefined);
    notificationsService.notifyBookingCancelled
      .mockReset()
      .mockResolvedValue(undefined);
    notificationsService.notifyBookingRescheduled
      .mockReset()
      .mockResolvedValue(undefined);
    googleCalendarService.createMeetEvent.mockReset().mockResolvedValue({
      eventId: 'fake-event-id',
      meetLink: 'https://meet.google.com/fake-link',
    });
    googleCalendarService.deleteEvent.mockReset().mockResolvedValue(undefined);
  });

  async function createBooking(
    overrides: {
      location?: LocationType;
      meetLink?: string;
      googleEventId?: string;
    } = {},
  ): Promise<BookingWithRelations> {
    const coach = await createTestCoach();
    await createFullWeekAvailability(coach.id);
    const eventType = await createTestEventType(coach.id, {
      locations: [overrides.location ?? LocationType.PHONE],
    });
    return testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        location: overrides.location ?? LocationType.PHONE,
        clientName: 'Test Client',
        clientEmail: 'client@example.com',
        clientPhone: '+36301234567',
        manageToken: `job-token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        meetLink: overrides.meetLink,
        googleEventId: overrides.googleEventId,
      },
      include: { eventType: true, coach: true },
    }) as unknown as Promise<BookingWithRelations>;
  }

  it('routes a "confirmed" job to notifyBookingConfirmed with the full booking', async () => {
    const booking = await createBooking();
    await service.enqueue(booking.id, 'confirmed');

    await waitFor(
      () => notificationsService.notifyBookingConfirmed.mock.calls.length > 0,
    );

    expect(notificationsService.notifyBookingConfirmed).toHaveBeenCalledTimes(
      1,
    );
    const [passed] = notificationsService.notifyBookingConfirmed.mock
      .calls[0] as [BookingWithRelations];
    expect(passed.id).toBe(booking.id);
    expect(notificationsService.notifyBookingCancelled).not.toHaveBeenCalled();
  });

  it('routes a "cancelled" job to notifyBookingCancelled', async () => {
    const booking = await createBooking();
    await service.enqueue(booking.id, 'cancelled');

    await waitFor(
      () => notificationsService.notifyBookingCancelled.mock.calls.length > 0,
    );
    expect(notificationsService.notifyBookingCancelled).toHaveBeenCalledTimes(
      1,
    );
  });

  it('routes a "rescheduled" job to notifyBookingRescheduled', async () => {
    const booking = await createBooking();
    await service.enqueue(booking.id, 'rescheduled');

    await waitFor(
      () => notificationsService.notifyBookingRescheduled.mock.calls.length > 0,
    );
    expect(notificationsService.notifyBookingRescheduled).toHaveBeenCalledTimes(
      1,
    );
  });

  it('drops the job without throwing when the booking no longer exists', async () => {
    await service.enqueue('does-not-exist-booking-id', 'confirmed');

    // Give the worker a couple of poll cycles to pick it up and skip it;
    // nothing to assert on directly beyond "the mock is never called".
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(notificationsService.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('retries a job that fails once, and eventually succeeds', async () => {
    const booking = await createBooking();
    notificationsService.notifyBookingConfirmed.mockRejectedValueOnce(
      new Error('transient SMTP failure'),
    );

    await service.enqueue(booking.id, 'confirmed');

    await waitFor(
      () => notificationsService.notifyBookingConfirmed.mock.calls.length >= 2,
      20_000,
    );
    expect(
      notificationsService.notifyBookingConfirmed.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('creates the Google Meet link for a confirmed GOOGLE_MEET booking before sending the email', async () => {
    const booking = await createBooking({ location: LocationType.GOOGLE_MEET });

    await service.enqueue(booking.id, 'confirmed');

    await waitFor(
      () => notificationsService.notifyBookingConfirmed.mock.calls.length > 0,
    );
    expect(googleCalendarService.createMeetEvent).toHaveBeenCalledTimes(1);
    const [passed] = notificationsService.notifyBookingConfirmed.mock
      .calls[0] as [BookingWithRelations];
    expect(passed.meetLink).toBe('https://meet.google.com/fake-link');
    expect(passed.googleEventId).toBe('fake-event-id');

    const persisted = await testPrisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(persisted.meetLink).toBe('https://meet.google.com/fake-link');
  });

  it('creates the Google Meet link for a rescheduled GOOGLE_MEET booking too', async () => {
    const booking = await createBooking({ location: LocationType.GOOGLE_MEET });

    await service.enqueue(booking.id, 'rescheduled');

    await waitFor(
      () => notificationsService.notifyBookingRescheduled.mock.calls.length > 0,
    );
    expect(googleCalendarService.createMeetEvent).toHaveBeenCalledTimes(1);
  });

  it('does not create a Meet link for a cancelled GOOGLE_MEET booking', async () => {
    const booking = await createBooking({ location: LocationType.GOOGLE_MEET });

    await service.enqueue(booking.id, 'cancelled');

    await waitFor(
      () => notificationsService.notifyBookingCancelled.mock.calls.length > 0,
    );
    expect(googleCalendarService.createMeetEvent).not.toHaveBeenCalled();
  });

  it('does not create a Meet link for a non-GOOGLE_MEET booking', async () => {
    const booking = await createBooking({ location: LocationType.PHONE });

    await service.enqueue(booking.id, 'confirmed');

    await waitFor(
      () => notificationsService.notifyBookingConfirmed.mock.calls.length > 0,
    );
    expect(googleCalendarService.createMeetEvent).not.toHaveBeenCalled();
  });

  it('does not create a duplicate Meet link if the booking already has one (idempotent retry)', async () => {
    const booking = await createBooking({
      location: LocationType.GOOGLE_MEET,
      meetLink: 'https://meet.google.com/already-there',
      googleEventId: 'already-there-id',
    });

    await service.enqueue(booking.id, 'confirmed');

    await waitFor(
      () => notificationsService.notifyBookingConfirmed.mock.calls.length > 0,
    );
    expect(googleCalendarService.createMeetEvent).not.toHaveBeenCalled();
    const [passed] = notificationsService.notifyBookingConfirmed.mock
      .calls[0] as [BookingWithRelations];
    expect(passed.meetLink).toBe('https://meet.google.com/already-there');
  });

  it('retries without deleting the booking if Meet link creation fails, and eventually succeeds', async () => {
    const booking = await createBooking({ location: LocationType.GOOGLE_MEET });
    googleCalendarService.createMeetEvent.mockRejectedValueOnce(
      new Error('Google API down'),
    );

    await service.enqueue(booking.id, 'confirmed');

    // Right after the first (failing) attempt: unlike the old synchronous
    // flow, a transient Google API failure here must not delete an
    // otherwise-valid booking -- it should just retry.
    await waitFor(
      () => googleCalendarService.createMeetEvent.mock.calls.length >= 1,
    );
    const afterFirstAttempt = await testPrisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(afterFirstAttempt).not.toBeNull();

    // The retry (using the now-resolved mock) should go on to succeed.
    await waitFor(
      () => notificationsService.notifyBookingConfirmed.mock.calls.length > 0,
    );
    expect(
      googleCalendarService.createMeetEvent.mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });
});
