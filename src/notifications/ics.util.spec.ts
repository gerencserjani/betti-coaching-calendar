import { buildIcsFile } from './ics.util.js';

describe('buildIcsFile', () => {
  const baseInput = {
    uid: 'booking-123@betti-coaching-calendar',
    title: 'Kezdő konzultáció',
    description: 'Első alkalom',
    location: 'Google Meet – https://meet.google.com/abc-defg-hij',
    startAt: new Date('2026-09-21T07:00:00.000Z'),
    endAt: new Date('2026-09-21T07:30:00.000Z'),
    organizer: { name: 'Gerencsér Bernadett', email: 'coach@example.com' },
    attendee: { name: 'Teszt Elek', email: 'client@example.com' },
  };

  it('produces a valid VCALENDAR/VEVENT block containing the key fields', () => {
    const ics = buildIcsFile(baseInput);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:booking-123@betti-coaching-calendar');
    expect(ics).toContain('SUMMARY:Kezdő konzultáció');
    expect(ics).toContain('ORGANIZER');
    expect(ics).toContain('Gerencsér Bernadett');
    expect(ics.toLowerCase()).toContain('mailto:coach@example.com');
    expect(ics).toContain('ATTENDEE');
    expect(ics.toLowerCase()).toContain('client@example.com');
    expect(ics).toContain('DTSTART:20260921T070000Z');
    expect(ics).toContain('DTEND:20260921T073000Z');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('works without a description', () => {
    const { description, ...withoutDescription } = baseInput;
    void description;
    expect(() => buildIcsFile(withoutDescription)).not.toThrow();
  });
});
