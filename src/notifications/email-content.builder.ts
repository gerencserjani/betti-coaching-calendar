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
    const t = (key: string, vars?: Record<string, string | number>) =>
      this.i18n.t(key, locale, vars);
    const details = this.buildDetails(ctx, locale);

    if (recipient === 'client') {
      return {
        subject: t('email.bookingConfirmed.client.subject', {
          title: ctx.eventTypeTitle,
        }),
        props: {
          previewText: t('email.bookingConfirmed.client.preview', {
            title: ctx.eventTypeTitle,
          }),
          heading: t('email.bookingConfirmed.client.heading'),
          intro: t('email.bookingConfirmed.client.intro', {
            name: ctx.clientName,
          }),
          detailsHeading: t('email.common.detailsHeading'),
          details,
          helperText: t('email.bookingConfirmed.client.manageHint'),
          secondaryButton: {
            label: t('email.common.buttonAddToGoogleCalendar'),
            url: ctx.googleCalendarUrl,
          },
          manageLinks: this.buildManageLinks(ctx, t),
          footer: t('email.common.footer'),
        },
      };
    }

    return {
      subject: t('email.bookingConfirmed.coach.subject', {
        title: ctx.eventTypeTitle,
      }),
      props: {
        previewText: t('email.bookingConfirmed.coach.preview', {
          clientName: ctx.clientName,
        }),
        heading: t('email.bookingConfirmed.coach.heading'),
        intro: t('email.bookingConfirmed.coach.intro', {
          clientName: ctx.clientName,
        }),
        detailsHeading: t('email.common.detailsHeading'),
        details,
        secondaryButton: {
          label: t('email.common.buttonAddToGoogleCalendar'),
          url: ctx.googleCalendarUrl,
        },
        footer: t('email.common.footer'),
      },
    };
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
    const t = (key: string, vars?: Record<string, string | number>) =>
      this.i18n.t(key, locale, vars);
    const details = this.buildDetails(ctx, locale);

    if (recipient === 'client') {
      return {
        subject: t('email.bookingRescheduled.client.subject', {
          title: ctx.eventTypeTitle,
        }),
        props: {
          previewText: t('email.bookingRescheduled.client.preview'),
          heading: t('email.bookingRescheduled.client.heading'),
          intro: t('email.bookingRescheduled.client.intro'),
          detailsHeading: t('email.common.detailsHeading'),
          details,
          helperText: t('email.bookingRescheduled.client.manageHint'),
          secondaryButton: {
            label: t('email.common.buttonAddToGoogleCalendar'),
            url: ctx.googleCalendarUrl,
          },
          manageLinks: this.buildManageLinks(ctx, t),
          footer: t('email.common.footer'),
        },
      };
    }

    return {
      subject: t('email.bookingRescheduled.coach.subject', {
        title: ctx.eventTypeTitle,
      }),
      props: {
        previewText: t('email.bookingRescheduled.coach.preview', {
          clientName: ctx.clientName,
        }),
        heading: t('email.bookingRescheduled.coach.heading'),
        intro: t('email.bookingRescheduled.coach.intro', {
          clientName: ctx.clientName,
        }),
        detailsHeading: t('email.common.detailsHeading'),
        details,
        secondaryButton: {
          label: t('email.common.buttonAddToGoogleCalendar'),
          url: ctx.googleCalendarUrl,
        },
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
