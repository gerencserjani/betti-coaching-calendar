import { DateTime } from 'luxon';

function toGoogleUtcStamp(date: Date): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat(
    "yyyyMMdd'T'HHmmss'Z'",
  );
}

export function buildGoogleCalendarQuickAddUrl(input: {
  title: string;
  description?: string;
  location: string;
  startAt: Date;
  endAt: Date;
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${toGoogleUtcStamp(input.startAt)}/${toGoogleUtcStamp(input.endAt)}`,
    details: input.description ?? '',
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
