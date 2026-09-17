import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { AvailabilityService } from '../availability/availability.service.js';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { QuerySlotsDto } from './dto/query-slots.dto.js';

export interface Slot {
  coachId: string;
  startAt: string;
  endAt: string;
}

const MAX_RANGE_DAYS = 90;

@Injectable()
export class SlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly settingsService: SettingsService,
  ) {}

  async computeSlots(query: QuerySlotsDto): Promise<Slot[]> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: query.eventTypeId },
    });
    if (!eventType || !eventType.isActive) {
      throw new NotFoundException('Event type not found');
    }

    const settings = await this.settingsService.get();
    const timezone = settings.businessTimezone;

    const from = DateTime.fromISO(query.from, { zone: timezone }).startOf(
      'day',
    );
    const to = DateTime.fromISO(query.to, { zone: timezone }).startOf('day');
    if (!from.isValid || !to.isValid || to < from) {
      throw new BadRequestException('Invalid date range');
    }
    if (to.diff(from, 'days').days > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Range may not exceed ${MAX_RANGE_DAYS} days`,
      );
    }

    const now = DateTime.now();
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        coachId: eventType.coachId,
        status: BookingStatus.CONFIRMED,
        startAt: { gte: from.toJSDate() },
        endAt: { lte: to.plus({ days: 1 }).toJSDate() },
      },
      select: { startAt: true, endAt: true },
    });

    const rangesByDate =
      await this.availabilityService.getEffectiveRangesForDateRange(
        eventType.coachId,
        from.toISODate()!,
        to.toISODate()!,
        timezone,
      );

    const slots: Slot[] = [];
    for (let day = from; day <= to; day = day.plus({ days: 1 })) {
      const isoDate = day.toISODate()!;
      const ranges = rangesByDate.get(isoDate) ?? [];

      for (const range of ranges) {
        for (
          let startMinute = range.startMinute;
          startMinute + eventType.durationMinutes <= range.endMinute;
          startMinute += eventType.durationMinutes
        ) {
          // Wall-clock arithmetic (set hour/minute), not elapsed-time
          // arithmetic (plus minutes) -- `day` may fall on a DST transition,
          // where adding elapsed minutes to midnight lands on the wrong
          // wall-clock hour.
          const startAt = day.set({
            hour: Math.floor(startMinute / 60),
            minute: startMinute % 60,
            second: 0,
            millisecond: 0,
          });
          const endAt = startAt.plus({ minutes: eventType.durationMinutes });

          if (startAt < now) {
            continue;
          }

          const conflicts = existingBookings.some(
            (booking) =>
              booking.startAt < endAt.toJSDate() &&
              booking.endAt > startAt.toJSDate(),
          );
          if (conflicts) {
            continue;
          }

          slots.push({
            coachId: eventType.coachId,
            startAt: startAt.toUTC().toISO()!,
            endAt: endAt.toUTC().toISO()!,
          });
        }
      }
    }

    return slots;
  }
}
