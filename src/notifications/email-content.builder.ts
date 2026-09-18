import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { I18nService } from '../i18n/i18n.service.js';
import { LocationType, type CancelledBy } from '@prisma/client';
import type { BookingEmailProps } from './templates/BookingEmail.js';

export type EmailRecipient = 'client' | 'coach';

export interface BookingEmailContext {
  eventTypeTitle: string;
  clientName: string;
  coachName: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  location: LocationType;
  businessAddress: string;
  meetLink?: string;
  clientPhone: string;
  timezone: string;
  manageUrl: string;
  googleCalendarUrl: string;
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
}

@Injectable()
export class EmailContentBuilder {
  constructor(private readonly i18n: I18nService) {}

  buildConfirmed(
    ctx: BookingEmailContext,
    recipient: EmailRecipient,
    locale: string,
  ): { subject: string; props: BookingEmailProps } {
    return this.buildScheduledEmail(ctx, recipient, locale, 'bookingConfirmed');
  }

  buildCancelled(
    ctx: BookingEmailContext,
    recipient: EmailRecipient,
    locale: string,
  ): { subject: string; props: BookingEmailProps } {
    const t = (key: string, vars?: Record<string, string | number>) =>
      this.i18n.t(key, locale, vars);
    const details = this.buildDetails(ctx, locale);
    const byClient = ctx.cancelledBy === 'CLIENT';
    const note = ctx.cancellationReason
      ? {
          label: t(`email.bookingCancelled.${recipient}.reasonLabel`),
          value: ctx.cancellationReason,
        }
      : undefined;

    if (recipient === 'client') {
      return {
        subject: t('email.bookingCancelled.client.subject', {
          title: ctx.eventTypeTitle,
        }),
        props: {
          previewText: t('email.bookingCancelled.client.preview'),
          heading: t('email.bookingCancelled.client.heading'),
          intro: t(
            byClient
              ? 'email.bookingCancelled.client.introByClient'
              : 'email.bookingCancelled.client.introByCoach',
          ),
          detailsHeading: t('email.common.detailsHeading'),
          details,
          note,
          helperText: t('email.bookingCancelled.client.rebookHint'),
          footer: t('email.common.footer'),
        },
      };
    }

    return {
      subject: t('email.bookingCancelled.coach.subject', {
        title: ctx.eventTypeTitle,
      }),
      props: {
        previewText: t('email.bookingCancelled.coach.preview'),
        heading: t('email.bookingCancelled.coach.heading'),
        intro: t(
          byClient
            ? 'email.bookingCancelled.coach.introByClient'
            : 'email.bookingCancelled.coach.introByCoach',
          { clientName: ctx.clientName },
        ),
        detailsHeading: t('email.common.detailsHeading'),
        details,
        note,
        footer: t('email.common.footer'),
      },
    };
  }

  buildRescheduled(
    ctx: BookingEmailContext,
    recipient: EmailRecipient,
    locale: string,
  ): { subject: string; props: BookingEmailProps } {
    return this.buildScheduledEmail(
      ctx,
      recipient,
      locale,
      'bookingRescheduled',
    );
  }

  /**
   * Shared by buildConfirmed/buildRescheduled -- both emails have the exact
   * same shape (details card, calendar button, manage links) and differ
   * only in which copy they pull from i18n and whether the "your calendar
   * event won't update itself" note applies (new bookings have nothing to
   * warn about yet; reschedules might already be on the client's calendar
   * under the old time).
   */
  private buildScheduledEmail(
    ctx: BookingEmailContext,
    recipient: EmailRecipient,
    locale: string,
    kind: 'bookingConfirmed' | 'bookingRescheduled',
  ): { subject: string; props: BookingEmailProps } {
    const t = (key: string, vars?: Record<string, string | number>) =>
      this.i18n.t(key, locale, vars);
    const details = this.buildDetails(ctx, locale);
    const vars = {
      title: ctx.eventTypeTitle,
      name: ctx.clientName,
      clientName: ctx.clientName,
    };
    const calendarButton = {
      label: t('email.common.buttonAddToGoogleCalendar'),
      url: ctx.googleCalendarUrl,
    };
    const calendarNote =
      kind === 'bookingRescheduled'
        ? t('email.common.calendarUpdateHint')
        : undefined;

    if (recipient === 'client') {
      return {
        subject: t(`email.${kind}.client.subject`, vars),
        props: {
          previewText: t(`email.${kind}.client.preview`, vars),
          heading: t(`email.${kind}.client.heading`),
          intro: t(`email.${kind}.client.intro`, vars),
          detailsHeading: t('email.common.detailsHeading'),
          details,
          helperText: t(`email.${kind}.client.manageHint`),
          secondaryButton: calendarButton,
          calendarNote,
          manageLinks: this.buildManageLinks(ctx, t),
          footer: t('email.common.footer'),
        },
      };
    }

    return {
      subject: t(`email.${kind}.coach.subject`, vars),
      props: {
        previewText: t(`email.${kind}.coach.preview`, vars),
        heading: t(`email.${kind}.coach.heading`),
        intro: t(`email.${kind}.coach.intro`, vars),
        detailsHeading: t('email.common.detailsHeading'),
        details,
        secondaryButton: calendarButton,
        calendarNote,
        footer: t('email.common.footer'),
      },
    };
  }

  private buildManageLinks(
    ctx: BookingEmailContext,
    t: (key: string, vars?: Record<string, string | number>) => string,
  ) {
    return [
      {
        label: t('email.common.linkCancelBooking'),
        url: `${ctx.manageUrl}&action=cancel#idopontfoglalas`,
      },
      {
        label: t('email.common.linkRescheduleBooking'),
        url: `${ctx.manageUrl}&action=reschedule#idopontfoglalas`,
      },
    ];
  }

  private buildDetails(ctx: BookingEmailContext, locale: string) {
    const t = (key: string, vars?: Record<string, string | number>) =>
      this.i18n.t(key, locale, vars);
    const start = DateTime.fromJSDate(ctx.startAt, {
      zone: ctx.timezone,
    }).setLocale(locale);
    const formattedDateTime = start.toLocaleString({
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      { label: t('email.common.labelEventType'), value: ctx.eventTypeTitle },
      { label: t('email.common.labelDateTime'), value: formattedDateTime },
      {
        label: t('email.common.labelDuration'),
        value: t('email.common.minutes', { count: ctx.durationMinutes }),
      },
      {
        label: t('email.common.labelLocation'),
        value: this.locationLabel(ctx, locale),
      },
    ];
  }

  private locationLabel(ctx: BookingEmailContext, locale: string): string {
    const t = (key: string, vars?: Record<string, string | number>) =>
      this.i18n.t(key, locale, vars);
    switch (ctx.location) {
      case LocationType.IN_PERSON:
        return t('email.common.locationInPerson', {
          address: ctx.businessAddress,
        });
      case LocationType.GOOGLE_MEET:
        return t('email.common.locationGoogleMeet', {
          link: ctx.meetLink ?? '',
        });
      case LocationType.PHONE:
        return t('email.common.locationPhone', { phone: ctx.clientPhone });
    }
  }
}
