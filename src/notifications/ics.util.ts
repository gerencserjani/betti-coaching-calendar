import { createEvent, type DateArray } from 'ics';
import { DateTime } from 'luxon';

export interface IcsInput {
  uid: string;
  title: string;
  description?: string;
  location: string;
  startAt: Date;
  endAt: Date;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
}

function toUtcArray(date: Date): DateArray {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' });
  return [dt.year, dt.month, dt.day, dt.hour, dt.minute];
}

export function buildIcsFile(input: IcsInput): string {
  const { error, value } = createEvent({
    uid: input.uid,
    title: input.title,
    description: input.description,
    location: input.location,
    start: toUtcArray(input.startAt),
    startInputType: 'utc',
    startOutputType: 'utc',
    end: toUtcArray(input.endAt),
    endInputType: 'utc',
    endOutputType: 'utc',
    organizer: input.organizer,
    attendees: [{ ...input.attendee, rsvp: false }],
    status: 'CONFIRMED',
  });

  if (error || !value) {
    throw error ?? new Error('Failed to build ICS file');
  }
  return value;
}
