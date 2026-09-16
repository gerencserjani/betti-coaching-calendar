import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import {
  CancelledBy,
  LocationType,
  type Booking,
  type Coach,
  type EventType,
} from '@prisma/client';
import { SettingsService } from '../settings/settings.service.js';
import {
  EmailContentBuilder,
  type BookingEmailContext,
} from './email-content.builder.js';
import { EmailService } from './email.service.js';
import { buildGoogleCalendarQuickAddUrl } from './google-calendar-link.util.js';
import { buildIcsFile } from './ics.util.js';

export type BookingWithRelations = Booking & {
  eventType: EventType;
  coach: Coach;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly emailService: EmailService,
    private readonly contentBuilder: EmailContentBuilder,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  async notifyBookingConfirmed(booking: BookingWithRelations): Promise<void> {
    const ctx = await this.buildContext(booking);
    await Promise.all([
      this.sendTo('client', 'confirmed', booking, ctx),
      this.sendTo('coach', 'confirmed', booking, ctx),
    ]);
  }

  async notifyBookingCancelled(booking: BookingWithRelations): Promise<void> {
    const ctx = await this.buildContext(booking);
    await Promise.all([
      this.sendTo('client', 'cancelled', booking, ctx),
      this.sendTo('coach', 'cancelled', booking, ctx),
    ]);
  }

  async notifyBookingRescheduled(booking: BookingWithRelations): Promise<void> {
    const ctx = await this.buildContext(booking);
    await Promise.all([
      this.sendTo('client', 'rescheduled', booking, ctx),
      this.sendTo('coach', 'rescheduled', booking, ctx),
    ]);
  }

  private async sendTo(
    recipient: 'client' | 'coach',
    kind: 'confirmed' | 'cancelled' | 'rescheduled',
    booking: BookingWithRelations,
    ctx: BookingEmailContext,
  ): Promise<void> {
    const locale =
      recipient === 'client' ? booking.locale : booking.coach.preferredLocale;
    const { subject, props } =
      kind === 'confirmed'
        ? this.contentBuilder.buildConfirmed(ctx, recipient, locale)
        : kind === 'cancelled'
          ? this.contentBuilder.buildCancelled(ctx, recipient, locale)
          : this.contentBuilder.buildRescheduled(ctx, recipient, locale);
    const to =
      recipient === 'client' ? booking.clientEmail : booking.coach.email;

    const icsContent =
      kind === 'cancelled'
        ? undefined
        : buildIcsFile({
            uid: `${booking.id}@betti-coaching-calendar`,
            title: booking.eventType.title,
            description: booking.clientNote ?? undefined,
            location:
              ctx.location === LocationType.GOOGLE_MEET
                ? (ctx.meetLink ?? '')
                : ctx.businessAddress,
            startAt: booking.startAt,
            endAt: booking.endAt,
            organizer: { name: booking.coach.name, email: booking.coach.email },
            attendee: { name: booking.clientName, email: booking.clientEmail },
          });

    await this.emailService.send({
      to,
      subject,
      props,
      icsContent,
      icsFilename: 'booking.ics',
    });
  }

  private async buildContext(
    booking: BookingWithRelations,
  ): Promise<BookingEmailContext> {
    const settings = await this.settingsService.get();
    const { frontendUrl } = this.configService.get<AppConfig>('app')!;

    return {
      eventTypeTitle: booking.eventType.title,
      clientName: booking.clientName,
      coachName: booking.coach.name,
      startAt: booking.startAt,
      endAt: booking.endAt,
      durationMinutes: booking.eventType.durationMinutes,
      location: booking.location,
      businessAddress: settings.businessAddress,
      meetLink: booking.meetLink ?? undefined,
      clientPhone: booking.clientPhone,
      timezone: settings.businessTimezone,
      manageUrl: `${frontendUrl}/bookings/manage?token=${booking.manageToken}`,
      googleCalendarUrl: buildGoogleCalendarQuickAddUrl({
        title: booking.eventType.title,
        description: booking.clientNote ?? undefined,
        location:
          booking.location === LocationType.GOOGLE_MEET
            ? (booking.meetLink ?? '')
            : settings.businessAddress,
        startAt: booking.startAt,
        endAt: booking.endAt,
      }),
      cancelledBy: booking.cancelledBy as CancelledBy | undefined,
      cancellationReason: booking.cancellationReason ?? undefined,
    };
  }
}
