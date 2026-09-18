import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { AvailabilityService } from '../availability/availability.service.js';
import { BookingStatus } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service.js';
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
    private readonly i18n: I18nService,
  ) {}

  async computeSlots(query: QuerySlotsDto): Promise<Slot[]> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: query.eventTypeId },
    });
    if (!eventType || !eventType.isActive) {
      throw new NotFoundException(
        this.i18n.t('errors.eventTypeNotFound', undefined),
      );
    }

    const settings = await this.settingsService.get();
    const timezone = settings.businessTimezone;

    const from = DateTime.fromISO(query.from, { zone: timezone }).startOf(
      'day',
    );
    const to = DateTime.fromISO(query.to, { zone: timezone }).startOf('day');
    if (!from.isValid || !to.isValid || to < from) {
      throw new BadRequestException(
        this.i18n.t('errors.invalidDateRange', undefined),
      );
    }
    if (to.diff(from, 'days').days > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        this.i18n.t('errors.rangeTooLong', undefined, {
          days: MAX_RANGE_DAYS,
        }),
      );
    }

    // Slots inside the notice window aren't offered at all -- a client
    // shouldn't be able to book (or reschedule into) a time the coach
    // wouldn't be allowed to cancel or move away from herself.
    const cutoff = DateTime.now().plus({
      hours: settings.cancellationNoticeHours,
    });
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        coachId: eventType.coachId,
        status: BookingStatus.CONFIRMED,
        id: query.excludeBookingId
          ? { not: query.excludeBookingId }
          : undefined,
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

          if (startAt < cutoff) {
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
