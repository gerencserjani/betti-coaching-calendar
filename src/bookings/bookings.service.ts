import {
  BadRequestException,
  ConflictException,
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
  LocationType,
  Prisma,
  type Coach,
} from '@prisma/client';
import { GoogleCalendarService } from '../google/google-calendar.service.js';
import { I18nService } from '../i18n/i18n.service.js';
import { NotificationJobsService } from '../jobs/notification-jobs.service.js';
import type { BookingWithRelations } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runSerializable } from '../common/serializable-transaction.util.js';
import { assertCoachOwnsOrIsAdmin } from '../common/ownership.util.js';
import { SettingsService } from '../settings/settings.service.js';
import type {
  ClientCancelBookingDto,
  CoachCancelBookingDto,
} from './dto/cancel-booking.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';

const MANAGE_TOKEN_LENGTH = 32;
const BOOKING_INCLUDE = { eventType: true, coach: true } as const;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly settingsService: SettingsService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationJobsService: NotificationJobsService,
    private readonly i18n: I18nService,
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
      throw new NotFoundException(
        this.i18n.t('errors.bookingNotFound', undefined),
      );
    }
    return booking;
  }

  async create(dto: CreateBookingDto): Promise<BookingWithRelations> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: dto.eventTypeId },
      include: { coach: true },
    });
    if (!eventType || !eventType.isActive) {
      throw new NotFoundException(
        this.i18n.t('errors.eventTypeNotFound', dto.locale),
      );
    }
    if (!eventType.locations.includes(dto.location)) {
      throw new BadRequestException(
        this.i18n.t('errors.locationNotOffered', dto.locale),
      );
    }

    const settings = await this.settingsService.get();
    const timezone = settings.businessTimezone;

    const startAt = DateTime.fromISO(dto.startAt, { setZone: true });
    if (!startAt.isValid) {
      throw new BadRequestException(
        this.i18n.t('errors.invalidStartAt', dto.locale),
      );
    }
    if (startAt < DateTime.now()) {
      throw new BadRequestException(
        this.i18n.t('errors.pastStartAt', dto.locale),
      );
    }
    const endAt = startAt.plus({ minutes: eventType.durationMinutes });
    this.assertSameCalendarDay(startAt, endAt, timezone, dto.locale);

    let booking = await runSerializable(this.prisma, async (tx) => {
      await this.assertSlotIsBookable(
        tx,
        eventType.coachId,
        startAt,
        endAt,
        timezone,
        dto.locale,
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
      booking = await this.attachFreshMeetLink(booking, dto.locale);
    }

    await this.notificationJobsService.enqueue(booking.id, 'confirmed');

    return booking;
  }

  async cancelByClient(
    token: string,
    dto: ClientCancelBookingDto,
  ): Promise<BookingWithRelations> {
    const booking = await this.findByManageToken(token);
    this.assertConfirmed(booking, booking.locale);
    await this.assertWithinNoticeWindow(booking.startAt, booking.locale);

    const updated = await this.applyCancellation(
      booking,
      CancelledBy.CLIENT,
      dto.reason,
    );
    await this.notificationJobsService.enqueue(updated.id, 'cancelled');
    return updated;
  }

  async cancelByCoach(
    coach: Coach,
    bookingId: string,
    dto: CoachCancelBookingDto,
  ): Promise<BookingWithRelations> {
    const found = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    const booking = assertCoachOwnsOrIsAdmin(
      coach,
      found,
      this.i18n.t('errors.bookingNotFound', coach.preferredLocale),
    );
    this.assertConfirmed(booking, coach.preferredLocale);

    const updated = await this.applyCancellation(
      booking,
      CancelledBy.COACH,
      dto.reason,
    );
    await this.notificationJobsService.enqueue(updated.id, 'cancelled');
    return updated;
  }

  async rescheduleByClient(
    token: string,
    dto: RescheduleBookingDto,
  ): Promise<BookingWithRelations> {
    const booking = await this.findByManageToken(token);
    this.assertConfirmed(booking, booking.locale);
    await this.assertWithinNoticeWindow(booking.startAt, booking.locale);

    const settings = await this.settingsService.get();
    const timezone = settings.businessTimezone;

    const startAt = DateTime.fromISO(dto.startAt, { setZone: true });
    if (!startAt.isValid) {
      throw new BadRequestException(
        this.i18n.t('errors.invalidStartAt', booking.locale),
      );
    }
    if (startAt < DateTime.now()) {
      throw new BadRequestException(
        this.i18n.t('errors.pastStartAt', booking.locale),
      );
    }
    const durationMinutes = DateTime.fromJSDate(booking.endAt).diff(
      DateTime.fromJSDate(booking.startAt),
      'minutes',
    ).minutes;
    const endAt = startAt.plus({ minutes: durationMinutes });
    this.assertSameCalendarDay(startAt, endAt, timezone, booking.locale);

    let updated = await runSerializable(this.prisma, async (tx) => {
      await this.assertSlotIsBookable(
        tx,
        booking.coachId,
        startAt,
        endAt,
        timezone,
        booking.locale,
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
        // Clear the now-dangling reference before attempting to create the
        // replacement event, so a failure below can't leave the booking
        // pointing at a Google event that no longer exists.
        updated = await this.prisma.booking.update({
          where: { id: updated.id },
          data: { meetLink: null, googleEventId: null },
          include: BOOKING_INCLUDE,
        });
      }
      // deleteOnFailure: false -- this booking already existed and was
      // confirmed before the reschedule; a transient Google API failure here
      // must not delete the client's booking outright (see attachFreshMeetLink).
      updated = await this.attachFreshMeetLink(updated, booking.locale, {
        deleteOnFailure: false,
      });
    }

    await this.notificationJobsService.enqueue(updated.id, 'rescheduled');

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
    locale: string,
    options: { deleteOnFailure: boolean } = { deleteOnFailure: true },
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
      if (options.deleteOnFailure) {
        // Only safe when called from create(): the booking was never
        // confirmed to the client, so nothing of value is lost by undoing it.
        this.logger.error(
          'Failed to create Google Meet link, rolling back booking',
          error,
        );
        await this.prisma.booking.delete({ where: { id: booking.id } });
        throw new ServiceUnavailableException(
          this.i18n.t('errors.meetLinkCreateFailed', locale),
        );
      }
      // Called from rescheduleByClient(): the booking already existed and
      // was already confirmed, and its new time is already committed -
      // deleting it here would destroy a real, previously-confirmed booking
      // over a transient Google API error. Leave it in place without a Meet
      // link instead and surface a clear error asking the client to retry.
      this.logger.error(
        'Failed to regenerate Google Meet link after reschedule; booking kept, link missing',
        error,
      );
      throw new ServiceUnavailableException(
        this.i18n.t('errors.meetLinkRegenerateFailed', locale),
      );
    }
  }

  private assertConfirmed(
    booking: { status: BookingStatus },
    locale: string,
  ): void {
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        this.i18n.t('errors.bookingNotActive', locale),
      );
    }
  }

  private async assertWithinNoticeWindow(
    startAt: Date,
    locale: string,
  ): Promise<void> {
    const settings = await this.settingsService.get();
    const cutoff = DateTime.now().plus({
      hours: settings.cancellationNoticeHours,
    });
    if (DateTime.fromJSDate(startAt) < cutoff) {
      throw new BadRequestException(
        this.i18n.t('errors.bookingNoticeWindow', locale, {
          hours: settings.cancellationNoticeHours,
        }),
      );
    }
  }

  private assertSameCalendarDay(
    startAt: DateTime,
    endAt: DateTime,
    timezone: string,
    locale: string,
  ): void {
    const startDate = startAt.setZone(timezone).toISODate();
    const endDate = endAt.setZone(timezone).toISODate();
    if (startDate !== endDate) {
      throw new BadRequestException(
        this.i18n.t('errors.spanMultipleDays', locale),
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
    locale: string,
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
        this.i18n.t('errors.outsideAvailability', locale),
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
      throw new ConflictException(this.i18n.t('errors.slotJustBooked', locale));
    }
  }
}
