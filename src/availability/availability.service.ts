import { ConflictException, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service.js';
import { type MinuteRange, rangesOverlap } from './availability.types.js';

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
  ): Promise<MinuteRange[]> {
    const overrides = await this.prisma.availabilityOverride.findMany({
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
    const weekly = await this.prisma.weeklyAvailability.findMany({
      where: { coachId, weekday },
    });
    return weekly.map((w) => ({
      startMinute: w.startMinute,
      endMinute: w.endMinute,
    }));
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

  /** Throws if `candidate` overlaps any OTHER coach's effective range on `isoDate`. */
  async assertNoCrossCoachConflictForDate(
    coachId: string,
    isoDate: string,
    timezone: string,
    candidate: MinuteRange,
  ): Promise<void> {
    const otherCoaches = await this.prisma.coach.findMany({
      where: { id: { not: coachId } },
      select: { id: true, name: true },
    });

    for (const other of otherCoaches) {
      const ranges = await this.getEffectiveRangesForDate(
        other.id,
        isoDate,
        timezone,
      );
      if (ranges.some((range) => rangesOverlap(range, candidate))) {
        throw new ConflictException(
          `Overlaps with ${other.name}'s availability on ${isoDate}. Only one coach may be on the shared calendar at a time.`,
        );
      }
    }
  }

  /** Throws if `candidate` overlaps any OTHER coach's recurring weekly schedule for the same weekday. */
  async assertNoCrossCoachConflictForWeekday(
    coachId: string,
    weekday: number,
    candidate: MinuteRange,
  ): Promise<void> {
    const otherCoachesWeekly = await this.prisma.weeklyAvailability.findMany({
      where: { coachId: { not: coachId }, weekday },
      include: { coach: { select: { name: true } } },
    });

    const conflict = otherCoachesWeekly.find((w) =>
      rangesOverlap(
        { startMinute: w.startMinute, endMinute: w.endMinute },
        candidate,
      ),
    );

    if (conflict) {
      throw new ConflictException(
        `Overlaps with ${conflict.coach.name}'s weekly schedule on weekday ${weekday}. Only one coach may be on the shared calendar at a time.`,
      );
    }
  }
}
