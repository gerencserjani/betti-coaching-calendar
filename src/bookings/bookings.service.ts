import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';
import { AvailabilityService } from '../availability/availability.service.js';
import type { MinuteRange } from '../availability/availability.types.js';
import {
  BookingStatus,
  CancelledBy,
  CoachRole,
  LocationType,
  Prisma,
  type Coach,
} from '@prisma/client';
import { GoogleCalendarService } from '../google/google-calendar.service.js';
import {
  NotificationsService,
  type BookingWithRelations,
} from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type {
  ClientCancelBookingDto,
  CoachCancelBookingDto,
} from './dto/cancel-booking.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';

const MANAGE_TOKEN_LENGTH = 32;
const SERIALIZATION_RETRY_ATTEMPTS = 3;
const BOOKING_INCLUDE = { eventType: true, coach: true } as const;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly settingsService: SettingsService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(): Promise<BookingWithRelations[]> {
    return this.prisma.booking.findMany({
      include: BOOKING_INCLUDE,
      orderBy: { startAt: 'asc' },
    });
  }

  async findByManageToken(token: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { manageToken: token },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async create(dto: CreateBookingDto): Promise<BookingWithRelations> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: dto.eventTypeId },
      include: { coach: true },
    });
    if (!eventType || !eventType.isActive) {
      throw new NotFoundException('Event type not found');
    }
    if (!eventType.locations.includes(dto.location)) {
      throw new BadRequestException(
        'This event type does not offer the selected location',
      );
    }

    const settings = await this.settingsService.get();
    const timezone = settings.businessTimezone;

    const startAt = DateTime.fromISO(dto.startAt, { setZone: true });
    if (!startAt.isValid) {
      throw new BadRequestException('Invalid startAt');
    }
    if (startAt < DateTime.now()) {
      throw new BadRequestException('Cannot book a time in the past');
    }
    const endAt = startAt.plus({ minutes: eventType.durationMinutes });
    this.assertSameCalendarDay(startAt, endAt, timezone);

    let booking = await this.runSerializable(async (tx) => {
      await this.assertSlotIsBookable(
        tx,
        eventType.coachId,
        startAt,
        endAt,
        timezone,
      );

      return tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          coachId: eventType.coachId,
          startAt: startAt.toJSDate(),
          endAt: endAt.toJSDate(),
          location: dto.location,
          clientName: dto.clientName,
          clientEmail: dto.clientEmail,
          clientPhone: dto.clientPhone,
          clientNote: dto.clientNote,
          locale: dto.locale,
          manageToken: nanoid(MANAGE_TOKEN_LENGTH),
        },
        include: BOOKING_INCLUDE,
      });
    });

    if (dto.location === LocationType.GOOGLE_MEET) {
      booking = await this.attachFreshMeetLink(booking);
    }

    this.notificationsService
      .notifyBookingConfirmed(booking)
      .catch((error: unknown) =>
        this.logger.error('Failed to send booking-confirmed emails', error),
      );

    return booking;
  }

  async cancelByClient(
    token: string,
    dto: ClientCancelBookingDto,
  ): Promise<BookingWithRelations> {
    const booking = await this.findByManageToken(token);
    this.assertConfirmed(booking);
    await this.assertWithinNoticeWindow(booking.startAt);

    const updated = await this.applyCancellation(
      booking,
      CancelledBy.CLIENT,
      dto.reason,
    );
    this.notificationsService
      .notifyBookingCancelled(updated)
      .catch((error: unknown) =>
        this.logger.error('Failed to send cancellation emails', error),
      );
    return updated;
  }

  async cancelByCoach(
    coach: Coach,
    bookingId: string,
    dto: CoachCancelBookingDto,
  ): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.coachId !== coach.id && coach.role !== CoachRole.ADMIN) {
      throw new ForbiddenException('Not the owner of this booking');
    }
    this.assertConfirmed(booking);

    const updated = await this.applyCancellation(
      booking,
      CancelledBy.COACH,
      dto.reason,
    );
    this.notificationsService
      .notifyBookingCancelled(updated)
      .catch((error: unknown) =>
        this.logger.error('Failed to send cancellation emails', error),
      );
    return updated;
  }

  async rescheduleByClient(
    token: string,
    dto: RescheduleBookingDto,
  ): Promise<BookingWithRelations> {
    const booking = await this.findByManageToken(token);
    this.assertConfirmed(booking);
    await this.assertWithinNoticeWindow(booking.startAt);

    const settings = await this.settingsService.get();
    const timezone = settings.businessTimezone;

    const startAt = DateTime.fromISO(dto.startAt, { setZone: true });
    if (!startAt.isValid) {
      throw new BadRequestException('Invalid startAt');
    }
    if (startAt < DateTime.now()) {
      throw new BadRequestException('Cannot book a time in the past');
    }
    const durationMinutes = DateTime.fromJSDate(booking.endAt).diff(
      DateTime.fromJSDate(booking.startAt),
      'minutes',
    ).minutes;
    const endAt = startAt.plus({ minutes: durationMinutes });
    this.assertSameCalendarDay(startAt, endAt, timezone);

    let updated = await this.runSerializable(async (tx) => {
      await this.assertSlotIsBookable(
        tx,
        booking.coachId,
        startAt,
        endAt,
        timezone,
        booking.id,
      );

      return tx.booking.update({
        where: { id: booking.id },
        data: { startAt: startAt.toJSDate(), endAt: endAt.toJSDate() },
        include: BOOKING_INCLUDE,
      });
    });

    if (updated.location === LocationType.GOOGLE_MEET) {
      if (updated.googleEventId) {
        await this.googleCalendarService.deleteEvent(updated.googleEventId);
      }
      updated = await this.attachFreshMeetLink(updated);
    }

    this.notificationsService
      .notifyBookingRescheduled(updated)
      .catch((error: unknown) =>
        this.logger.error('Failed to send reschedule emails', error),
      );

    return updated;
  }

  private async applyCancellation(
    booking: BookingWithRelations,
    cancelledBy: CancelledBy,
    reason: string | undefined,
  ): Promise<BookingWithRelations> {
    if (booking.googleEventId) {
      await this.googleCalendarService.deleteEvent(booking.googleEventId);
    }
    return this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy,
        cancellationReason: reason,
      },
      include: BOOKING_INCLUDE,
    });
  }

  private async attachFreshMeetLink(
    booking: BookingWithRelations,
  ): Promise<BookingWithRelations> {
    try {
      const meet = await this.googleCalendarService.createMeetEvent({
        title: `${booking.eventType.title} — ${booking.clientName}`,
        description: booking.clientNote ?? undefined,
        startAt: booking.startAt,
        endAt: booking.endAt,
        attendeeEmails: [booking.clientEmail, booking.coach.email],
      });
      return this.prisma.booking.update({
        where: { id: booking.id },
        data: { meetLink: meet.meetLink, googleEventId: meet.eventId },
        include: BOOKING_INCLUDE,
      });
    } catch (error) {
      this.logger.error(
        'Failed to create Google Meet link, rolling back booking',
        error,
      );
      await this.prisma.booking.delete({ where: { id: booking.id } });
      throw new ServiceUnavailableException(
        'Could not create the Google Meet link, please try again',
      );
    }
  }

  private assertConfirmed(booking: { status: BookingStatus }): void {
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('This booking is not active');
    }
  }

  private async assertWithinNoticeWindow(startAt: Date): Promise<void> {
    const settings = await this.settingsService.get();
    const cutoff = DateTime.now().plus({
      hours: settings.cancellationNoticeHours,
    });
    if (DateTime.fromJSDate(startAt) < cutoff) {
      throw new BadRequestException(
        `This booking can only be changed at least ${settings.cancellationNoticeHours} hours in advance`,
      );
    }
  }

  private assertSameCalendarDay(
    startAt: DateTime,
    endAt: DateTime,
    timezone: string,
  ): void {
    const startDate = startAt.setZone(timezone).toISODate();
    const endDate = endAt.setZone(timezone).toISODate();
    if (startDate !== endDate) {
      throw new BadRequestException(
        'Booking may not span multiple calendar days',
      );
    }
  }

  /** Must run inside the same transaction as the write that reserves the slot. */
  private async assertSlotIsBookable(
    tx: Prisma.TransactionClient,
    coachId: string,
    startAt: DateTime,
    endAt: DateTime,
    timezone: string,
    excludeBookingId?: string,
  ): Promise<void> {
    const inTz = startAt.setZone(timezone);
    const isoDate = inTz.toISODate()!;
    const candidate: MinuteRange = {
      startMinute: inTz.hour * 60 + inTz.minute,
      endMinute: endAt.setZone(timezone).diff(inTz.startOf('day'), 'minutes')
        .minutes,
    };

    const withinSchedule =
      await this.availabilityService.isWithinEffectiveRange(
        coachId,
        isoDate,
        timezone,
        candidate,
      );
    if (!withinSchedule) {
      throw new ConflictException(
        "Selected time is outside the coach's availability",
      );
    }

    const overlapping = await tx.booking.findFirst({
      where: {
        coachId,
        status: BookingStatus.CONFIRMED,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        startAt: { lt: endAt.toJSDate() },
        endAt: { gt: startAt.toJSDate() },
      },
    });
    if (overlapping) {
      throw new ConflictException(
        'Selected time was just booked - please pick another slot',
      );
    }
  }

  private async runSerializable<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= SERIALIZATION_RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const isSerializationFailure =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (
          !isSerializationFailure ||
          attempt === SERIALIZATION_RETRY_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'Could not complete the booking, please try again',
    );
  }
}
