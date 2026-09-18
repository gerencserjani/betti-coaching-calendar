import { buildGoogleCalendarQuickAddUrl } from './google-calendar-link.util.js';

describe('buildGoogleCalendarQuickAddUrl', () => {
  it('builds a well-formed Google Calendar quick-add URL with UTC-formatted dates', () => {
    const url = buildGoogleCalendarQuickAddUrl({
      title: 'Kezdő konzultáció',
      description: 'Ügyfél: Teszt Elek',
      location: 'Budapest, Teszt utca 1.',
      startAt: new Date('2026-09-21T07:00:00.000Z'),
      endAt: new Date('2026-09-21T07:30:00.000Z'),
    });

    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    const params = new URL(url).searchParams;
    expect(params.get('action')).toBe('TEMPLATE');
    expect(params.get('text')).toBe('Kezdő konzultáció');
    expect(params.get('dates')).toBe('20260921T070000Z/20260921T073000Z');
    expect(params.get('location')).toBe('Budapest, Teszt utca 1.');
  });

  it('omits details when no description is given', () => {
    const url = buildGoogleCalendarQuickAddUrl({
      title: 'Event',
      location: 'Somewhere',
      startAt: new Date('2026-01-01T00:00:00.000Z'),
      endAt: new Date('2026-01-01T00:30:00.000Z'),
    });
    expect(new URL(url).searchParams.get('details')).toBe('');
  });
});
