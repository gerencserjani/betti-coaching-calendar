import { CancelledBy, LocationType } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service.js';
import {
  EmailContentBuilder,
  type BookingEmailContext,
} from './email-content.builder.js';

function baseContext(
  overrides: Partial<BookingEmailContext> = {},
): BookingEmailContext {
  return {
    eventTypeTitle: 'Kezdő konzultáció',
    clientName: 'Teszt Elek',
    coachName: 'Gerencsér Bernadett',
    startAt: new Date('2026-09-21T07:00:00.000Z'),
    endAt: new Date('2026-09-21T07:30:00.000Z'),
    durationMinutes: 30,
    location: LocationType.PHONE,
    businessAddress: 'Budapest, Teszt utca 1.',
    clientPhone: '+36301234567',
    timezone: 'Europe/Budapest',
    manageUrl: 'https://example.com/manage?token=abc',
    googleCalendarUrl: 'https://calendar.google.com/calendar/render?...',
    ...overrides,
  };
}

describe('EmailContentBuilder', () => {
  let builder: EmailContentBuilder;

  beforeAll(async () => {
    const i18n = new I18nService();
    await i18n.onModuleInit();
    builder = new EmailContentBuilder(i18n);
  });

  describe('buildConfirmed', () => {
    it('builds client content with manage links and a calendar button', () => {
      const { subject, props } = builder.buildConfirmed(
        baseContext(),
        'client',
        'hu',
      );
      expect(subject).toContain('Kezdő konzultáció');
      expect(props.manageLinks).toEqual([
        {
          label: 'Lemondás',
          url: 'https://example.com/manage?token=abc&action=cancel#idopontfoglalas',
        },
        {
          label: 'Időpont módosítása',
          url: 'https://example.com/manage?token=abc&action=reschedule#idopontfoglalas',
        },
      ]);
      expect(props.secondaryButton?.url).toContain('calendar.google.com');
      expect(props.details).toHaveLength(4);
    });

    it('builds coach content without manage links (only the coach-facing calendar link)', () => {
      const { props } = builder.buildConfirmed(baseContext(), 'coach', 'hu');
      expect(props.manageLinks).toBeUndefined();
      expect(props.secondaryButton?.url).toContain('calendar.google.com');
    });

    it('renders in English when locale=en', () => {
      const { props } = builder.buildConfirmed(baseContext(), 'client', 'en');
      expect(props.heading).toBe('Your booking is confirmed');
    });

    it('includes the phone number in the location detail for a PHONE booking', () => {
      const { props } = builder.buildConfirmed(
        baseContext({ location: LocationType.PHONE }),
        'client',
        'hu',
      );
      const locationDetail = props.details.find((d) => d.label === 'Helyszín');
      expect(locationDetail?.value).toContain('+36301234567');
    });

    it('includes the business address for an IN_PERSON booking', () => {
      const { props } = builder.buildConfirmed(
        baseContext({ location: LocationType.IN_PERSON }),
        'client',
        'hu',
      );
      const locationDetail = props.details.find((d) => d.label === 'Helyszín');
      expect(locationDetail?.value).toContain('Budapest, Teszt utca 1.');
    });

    it('includes the Meet link for a GOOGLE_MEET booking', () => {
      const { props } = builder.buildConfirmed(
        baseContext({
          location: LocationType.GOOGLE_MEET,
          meetLink: 'https://meet.google.com/abc-defg-hij',
        }),
        'client',
        'hu',
      );
      const locationDetail = props.details.find((d) => d.label === 'Helyszín');
      expect(locationDetail?.value).toContain(
        'https://meet.google.com/abc-defg-hij',
      );
    });
  });

  describe('buildCancelled', () => {
    it('includes the reason as a note when the client cancels with one', () => {
      const { props } = builder.buildCancelled(
        baseContext({
          cancelledBy: CancelledBy.CLIENT,
          cancellationReason: 'közbejött valami',
        }),
        'coach',
        'hu',
      );
      expect(props.note).toEqual({
        label: 'Indoklás',
        value: 'közbejött valami',
      });
    });

    it('omits the note when there is no reason', () => {
      const { props } = builder.buildCancelled(
        baseContext({ cancelledBy: CancelledBy.CLIENT }),
        'client',
        'hu',
      );
      expect(props.note).toBeUndefined();
    });

    it('uses different client copy depending on who cancelled', () => {
      const byClient = builder.buildCancelled(
        baseContext({ cancelledBy: CancelledBy.CLIENT }),
        'client',
        'hu',
      );
      const byCoach = builder.buildCancelled(
        baseContext({ cancelledBy: CancelledBy.COACH }),
        'client',
        'hu',
      );
      expect(byClient.props.intro).not.toBe(byCoach.props.intro);
    });
  });

  describe('buildRescheduled', () => {
    it('builds client content with an updated details block reflecting the new time', () => {
      const { props } = builder.buildRescheduled(baseContext(), 'client', 'hu');
      const dateTime = props.details.find((d) => d.label === 'Időpont');
      expect(dateTime?.value).toContain('2026');
    });

    it('reminds the client to update their calendar since the quick-add link creates a fresh event', () => {
      const { props } = builder.buildRescheduled(baseContext(), 'client', 'hu');
      expect(props.calendarNote).toBe(
        'Ha a korábbi időpontot már hozzáadtad a naptáradhoz, kérjük töröld azt, és vedd fel helyette az újat a fenti gombbal.',
      );
    });

    it('also reminds the coach, since they get the same quick-add button', () => {
      const { props } = builder.buildRescheduled(baseContext(), 'coach', 'hu');
      expect(props.calendarNote).toBe(
        'Ha a korábbi időpontot már hozzáadtad a naptáradhoz, kérjük töröld azt, és vedd fel helyette az újat a fenti gombbal.',
      );
    });
  });
});
