import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import {
  CancelledBy,
  LocationType,
  type Booking,
  type Coach,
  type EventType,
  type Settings,
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
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly contentBuilder: EmailContentBuilder,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  async notifyBookingConfirmed(booking: BookingWithRelations): Promise<void> {
    const settings = await this.settingsService.get(booking.coachId);
    const ctx = await this.buildContext(booking, settings);
    await Promise.all([
      this.sendTo('client', 'confirmed', booking, ctx, settings.emailFrom),
      this.sendTo('coach', 'confirmed', booking, ctx, settings.emailFrom),
    ]);
  }

  async notifyBookingCancelled(booking: BookingWithRelations): Promise<void> {
    const settings = await this.settingsService.get(booking.coachId);
    const ctx = await this.buildContext(booking, settings);
    await Promise.all([
      this.sendTo('client', 'cancelled', booking, ctx, settings.emailFrom),
      this.sendTo('coach', 'cancelled', booking, ctx, settings.emailFrom),
    ]);
  }

  async notifyBookingRescheduled(booking: BookingWithRelations): Promise<void> {
    const settings = await this.settingsService.get(booking.coachId);
    const ctx = await this.buildContext(booking, settings);
    await Promise.all([
      this.sendTo('client', 'rescheduled', booking, ctx, settings.emailFrom),
      this.sendTo('coach', 'rescheduled', booking, ctx, settings.emailFrom),
    ]);
  }

  private async sendTo(
    recipient: 'client' | 'coach',
    kind: 'confirmed' | 'cancelled' | 'rescheduled',
    booking: BookingWithRelations,
    ctx: BookingEmailContext,
    emailFrom: string | null,
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
            location: this.resolveLocationText(booking, ctx.businessAddress),
            startAt: booking.startAt,
            endAt: booking.endAt,
            organizer: { name: booking.coach.name, email: booking.coach.email },
            attendee: { name: booking.clientName, email: booking.clientEmail },
          });

    try {
      await this.emailService.send({
        to,
        subject,
        props,
        icsContent,
        icsFilename: 'booking.ics',
        from: emailFrom,
      });
      this.logger.log(
        `Sent ${kind} email to ${recipient} for booking ${booking.id} (coach ${booking.coachId})`,
      );
    } catch (error) {
      // Rethrown as-is -- the caller (NotificationJobsService) already logs
      // and retries the job -- this just records *which* recipient failed,
      // since a Promise.all rejection alone doesn't say.
      this.logger.error(
        `Failed to send ${kind} email to ${recipient} for booking ${booking.id} (coach ${booking.coachId})`,
      );
      throw error;
    }
  }

  private async buildContext(
    booking: BookingWithRelations,
    settings: Settings,
  ): Promise<BookingEmailContext> {
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
      logoUrl: `${frontendUrl}/email-logo.png`,
      // The frontend has no /bookings/manage route -- the manage UI lives
      // inline in the booking section on the homepage, reading a `manage`
      // query param (see Booking.tsx). No hash here: the content builder
      // appends an `action` query param plus the #idopontfoglalas hash
      // (which must come after all query params, or it'd be swallowed
      // into the fragment instead of the query string).
      manageUrl: `${frontendUrl}/?manage=${booking.manageToken}`,
      googleCalendarUrl: buildGoogleCalendarQuickAddUrl({
        title: booking.eventType.title,
        description: booking.clientNote ?? undefined,
        location: this.resolveLocationText(booking, settings.businessAddress),
        startAt: booking.startAt,
        endAt: booking.endAt,
      }),
      cancelledBy: booking.cancelledBy as CancelledBy | undefined,
      cancellationReason: booking.cancellationReason ?? undefined,
    };
  }

  /**
   * Shared by the Google Calendar quick-add link and the .ics attachment -
   * both take arbitrary free-text location fields (no format restriction),
   * so a PHONE booking gets its own plain label in both instead of falling
   * back to the business's physical address, which would be misleading for
   * a call.
   */
  private resolveLocationText(
    booking: BookingWithRelations,
    businessAddress: string,
  ): string {
    switch (booking.location) {
      case LocationType.GOOGLE_MEET:
        return booking.meetLink ?? '';
      case LocationType.PHONE:
        return 'Telefon';
      case LocationType.IN_PERSON:
        return businessAddress;
    }
  }
}
