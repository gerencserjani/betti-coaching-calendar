import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MinuteRange } from './availability.types.js';

/** Whatever DB client a conflict check runs against: the plain PrismaService for
 * a one-off read, or a Prisma.TransactionClient when the read must be
 * serialized against a concurrent write deciding the same thing. */
type DbClient = PrismaService | Prisma.TransactionClient;

/** Truncates an ISO date string ("2026-12-24") to a UTC-midnight Date, matching how Prisma reads/writes a `@db.Date` column. */
export function toDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function isoWeekdayOf(isoDate: string, timezone: string): number {
  return DateTime.fromISO(isoDate, { zone: timezone }).weekday;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The ranges a coach is actually bookable in on a given calendar date:
   * their date-specific overrides if any exist, otherwise their recurring
   * weekly schedule for that weekday.
   */
  async getEffectiveRangesForDate(
    coachId: string,
    isoDate: string,
    timezone: string,
    client: DbClient = this.prisma,
  ): Promise<MinuteRange[]> {
    const overrides = await client.availabilityOverride.findMany({
      where: { coachId, date: toDateOnly(isoDate) },
    });

    if (overrides.length > 0) {
      if (overrides.some((o) => o.isUnavailable)) {
        return [];
      }
      return overrides.map((o) => ({
        startMinute: o.startMinute!,
        endMinute: o.endMinute!,
      }));
    }

    const weekday = isoWeekdayOf(isoDate, timezone);
    const weekly = await client.weeklyAvailability.findMany({
      where: { coachId, weekday },
    });
    return weekly.map((w) => ({
      startMinute: w.startMinute,
      endMinute: w.endMinute,
    }));
  }

  /**
   * Same as getEffectiveRangesForDate, but for a whole date range in 2 queries
   * total instead of up to 2 queries per day -- used by slot computation,
   * which would otherwise issue an unbounded, unauthenticated N+1 for a
   * 90-day range.
   */
  async getEffectiveRangesForDateRange(
    coachId: string,
    fromIsoDate: string,
    toIsoDate: string,
    timezone: string,
  ): Promise<Map<string, MinuteRange[]>> {
    const [overrides, weekly] = await Promise.all([
      this.prisma.availabilityOverride.findMany({
        where: {
          coachId,
          date: { gte: toDateOnly(fromIsoDate), lte: toDateOnly(toIsoDate) },
        },
      }),
      this.prisma.weeklyAvailability.findMany({ where: { coachId } }),
    ]);

    const overridesByDate = new Map<string, typeof overrides>();
    for (const o of overrides) {
      const key = o.date.toISOString().slice(0, 10);
      const list = overridesByDate.get(key);
      if (list) {
        list.push(o);
      } else {
        overridesByDate.set(key, [o]);
      }
    }

    const weeklyByWeekday = new Map<number, MinuteRange[]>();
    for (const w of weekly) {
      const range = { startMinute: w.startMinute, endMinute: w.endMinute };
      const list = weeklyByWeekday.get(w.weekday);
      if (list) {
        list.push(range);
      } else {
        weeklyByWeekday.set(w.weekday, [range]);
      }
    }

    const result = new Map<string, MinuteRange[]>();
    for (
      let day = DateTime.fromISO(fromIsoDate, { zone: timezone });
      day.toISODate()! <= toIsoDate;
      day = day.plus({ days: 1 })
    ) {
      const isoDate = day.toISODate()!;
      const dayOverrides = overridesByDate.get(isoDate);
      if (dayOverrides && dayOverrides.length > 0) {
        result.set(
          isoDate,
          dayOverrides.some((o) => o.isUnavailable)
            ? []
            : dayOverrides.map((o) => ({
                startMinute: o.startMinute!,
                endMinute: o.endMinute!,
              })),
        );
        continue;
      }
      const weekday = isoWeekdayOf(isoDate, timezone);
      result.set(isoDate, weeklyByWeekday.get(weekday) ?? []);
    }
    return result;
  }

  /** Whether `candidate` fits entirely inside one of the coach's effective ranges on `isoDate`. */
  async isWithinEffectiveRange(
    coachId: string,
    isoDate: string,
    timezone: string,
    candidate: MinuteRange,
  ): Promise<boolean> {
    const ranges = await this.getEffectiveRangesForDate(
      coachId,
      isoDate,
      timezone,
    );
    return ranges.some(
      (range) =>
        range.startMinute <= candidate.startMinute &&
        range.endMinute >= candidate.endMinute,
    );
  }
}
