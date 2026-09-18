import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { LocationType, type Coach, type EventType } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { createTestCoach, createTestEventType } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { EmailContentBuilder } from './email-content.builder.js';
import { EmailService, type SendEmailInput } from './email.service.js';
import {
  NotificationsService,
  type BookingWithRelations,
} from './notifications.service.js';

function fakeConfigService(): ConfigService {
  return {
    get: () => ({ frontendUrl: 'https://example.com' }),
  } as unknown as ConfigService;
}

function fakeEmailService(): jest.Mocked<EmailService> {
  return {
    send: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EmailService>;
}

describe('NotificationsService (integration)', () => {
  const prisma = testPrisma as unknown as PrismaService;
  const settingsService = new SettingsService(prisma);
  let contentBuilder: EmailContentBuilder;
  let emailService: jest.Mocked<EmailService>;
  let service: NotificationsService;
  let coach: Coach;
  let eventType: EventType;

  beforeAll(async () => {
    const i18n = new I18nService();
    await i18n.onModuleInit();
    contentBuilder = new EmailContentBuilder(i18n);
  });

  beforeEach(async () => {
    await resetDatabase();
    await testPrisma.settings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', businessAddress: 'Budapest, Teszt utca 1.' },
      update: { businessAddress: 'Budapest, Teszt utca 1.' },
    });
    coach = await createTestCoach();
    eventType = await createTestEventType(coach.id);
    emailService = fakeEmailService();
    service = new NotificationsService(
      emailService,
      contentBuilder,
      settingsService,
      fakeConfigService(),
    );
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  async function createBooking(
    location: LocationType,
  ): Promise<BookingWithRelations> {
    return testPrisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        coachId: coach.id,
        startAt: new Date('2026-10-01T07:00:00.000Z'),
        endAt: new Date('2026-10-01T07:30:00.000Z'),
        location,
        clientName: 'Teszt Elek',
        clientEmail: 'client@example.com',
        clientPhone: '+36301234567',
        manageToken: `notify-token-${location}`,
        ...(location === LocationType.GOOGLE_MEET
          ? {
              meetLink: 'https://meet.google.com/abc-defg-hij',
              googleEventId: 'evt-1',
            }
          : {}),
      },
      include: { eventType: true, coach: true },
    }) as unknown as Promise<BookingWithRelations>;
  }

  function clientCalendarUrl(): string {
    const clientCall = emailService.send.mock.calls.find(
      ([input]) => (input as SendEmailInput).to === 'client@example.com',
    );
    const props = (clientCall?.[0] as SendEmailInput).props;
    return props.secondaryButton!.url;
  }

  it('uses the Google Meet link as the calendar location for a GOOGLE_MEET booking', async () => {
    const booking = await createBooking(LocationType.GOOGLE_MEET);
    await service.notifyBookingConfirmed(booking);

    const url = new URL(clientCalendarUrl());
    expect(url.searchParams.get('location')).toBe(
      'https://meet.google.com/abc-defg-hij',
    );
  });

  it('uses the business address as the calendar location for an IN_PERSON booking', async () => {
    const booking = await createBooking(LocationType.IN_PERSON);
    await service.notifyBookingConfirmed(booking);

    const url = new URL(clientCalendarUrl());
    expect(url.searchParams.get('location')).toBe('Budapest, Teszt utca 1.');
  });

  it('uses a phone label, not the business address, as the calendar location for a PHONE booking', async () => {
    const booking = await createBooking(LocationType.PHONE);
    await service.notifyBookingConfirmed(booking);

    const url = new URL(clientCalendarUrl());
    expect(url.searchParams.get('location')).toBe('Telefon');
    expect(url.searchParams.get('location')).not.toBe(
      'Budapest, Teszt utca 1.',
    );
  });
});
