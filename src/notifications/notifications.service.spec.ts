import { jest } from '@jest/globals';
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
import { DEFAULT_EMAIL_PALETTE } from './templates/BookingEmail.js';

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
    coach = await createTestCoach();
    await testPrisma.settings.upsert({
      where: { coachId: coach.id },
      create: {
        coachId: coach.id,
        businessAddress: 'Budapest, Teszt utca 1.',
      },
      update: { businessAddress: 'Budapest, Teszt utca 1.' },
    });
    eventType = await createTestEventType(coach.id);
    emailService = fakeEmailService();
    service = new NotificationsService(
      emailService,
      contentBuilder,
      settingsService,
    );
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  async function createBooking(
    location: LocationType,
    originUrl: string | null = 'https://betti-coaching.vercel.app',
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
        manageToken: `notify-token-${location}-${originUrl ?? 'null'}`,
        originUrl,
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

  function clientEmailInput(): SendEmailInput {
    const clientCall = emailService.send.mock.calls.find(
      ([input]) => (input as SendEmailInput).to === 'client@example.com',
    );
    return clientCall?.[0] as SendEmailInput;
  }

  function clientCalendarUrlLocation(): string | null {
    return new URL(
      clientEmailInput().props.secondaryButton!.url,
    ).searchParams.get('location');
  }

  function icsLocationLine(): string | undefined {
    return clientEmailInput()
      .icsContent?.split('\r\n')
      .find((line) => line.startsWith('LOCATION:'));
  }

  it('uses the Google Meet link as the location, in both the calendar link and the .ics file, for a GOOGLE_MEET booking', async () => {
    const booking = await createBooking(LocationType.GOOGLE_MEET);
    await service.notifyBookingConfirmed(booking);

    expect(clientCalendarUrlLocation()).toBe(
      'https://meet.google.com/abc-defg-hij',
    );
    expect(icsLocationLine()).toBe(
      'LOCATION:https://meet.google.com/abc-defg-hij',
    );
  });

  it('uses the business address as the location, in both the calendar link and the .ics file, for an IN_PERSON booking', async () => {
    const booking = await createBooking(LocationType.IN_PERSON);
    await service.notifyBookingConfirmed(booking);

    expect(clientCalendarUrlLocation()).toBe('Budapest, Teszt utca 1.');
    expect(icsLocationLine()).toBe('LOCATION:Budapest\\, Teszt utca 1.');
  });

  it('uses a phone label, not the business address, in both the calendar link and the .ics file, for a PHONE booking', async () => {
    const booking = await createBooking(LocationType.PHONE);
    await service.notifyBookingConfirmed(booking);

    expect(clientCalendarUrlLocation()).toBe('Telefon');
    expect(icsLocationLine()).toBe('LOCATION:Telefon');
  });

  it("builds the logo/manage links from this booking's own originUrl, not a site-wide setting", async () => {
    const booking = await createBooking(
      LocationType.PHONE,
      'https://peti-coaching.vercel.app',
    );
    await service.notifyBookingConfirmed(booking);

    expect(clientEmailInput().props.logoUrl).toBe(
      'https://peti-coaching.vercel.app/email-logo.png',
    );
  });

  it('still builds an email (with a degraded link) when a booking has no originUrl', async () => {
    const booking = await createBooking(LocationType.PHONE, null);

    await expect(
      service.notifyBookingConfirmed(booking),
    ).resolves.toBeUndefined();
    expect(clientEmailInput().props.logoUrl).toBe('/email-logo.png');
  });

  describe('branding fallback chain', () => {
    it("falls back to the coach's own name, no tagline, and the default palette when Settings has no branding set", async () => {
      const booking = await createBooking(LocationType.PHONE);
      await service.notifyBookingConfirmed(booking);

      const { props } = clientEmailInput();
      expect(props.brandName).toBe(coach.name);
      expect(props.brandTagline).toBeUndefined();
      expect(props.palette).toEqual(DEFAULT_EMAIL_PALETTE);
    });

    it("uses this coach's own brandName/brandTagline/emailBrandPalette once set", async () => {
      const customPalette = {
        ...DEFAULT_EMAIL_PALETTE,
        light: { ...DEFAULT_EMAIL_PALETTE.light, accent: '#123456' },
      };
      await testPrisma.settings.update({
        where: { coachId: coach.id },
        data: {
          brandName: 'Kovács Anna',
          brandTagline: 'Életvezetési coach',
          emailBrandPalette: customPalette,
        },
      });
      const booking = await createBooking(LocationType.PHONE);
      await service.notifyBookingConfirmed(booking);

      const { props } = clientEmailInput();
      expect(props.brandName).toBe('Kovács Anna');
      expect(props.brandTagline).toBe('Életvezetési coach');
      expect(props.palette).toEqual(customPalette);
    });
  });
});
