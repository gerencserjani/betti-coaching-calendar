import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LocationType } from '@prisma/client';
import type { JobWithMetadata } from 'pg-boss';
import { GoogleCalendarService } from '../google/google-calendar.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationsService,
  type BookingWithRelations,
} from '../notifications/notifications.service.js';
import { PgBossService } from './pgboss.service.js';

const QUEUE_NAME = 'booking-notification';
const BOOKING_INCLUDE = { eventType: true, coach: true } as const;

type NotificationKind = 'confirmed' | 'cancelled' | 'rescheduled';

interface NotificationJobData {
  bookingId: string;
  kind: NotificationKind;
}

/**
 * Durable, retrying replacement for the old fire-and-forget
 * `notificationsService.notifyX(booking).catch(log)` calls. Enqueuing writes
 * the job to Postgres before the HTTP response returns, so a failed send is
 * never silently lost - it just retries (~5s/10s/20s backoff) for as long as
 * this process instance stays alive, then waits as `pending` for the next
 * real request to pick it back up. See README "Background jobs".
 */
@Injectable()
export class NotificationJobsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationJobsService.name);

  constructor(
    private readonly pgBossService: PgBossService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { boss } = this.pgBossService;
    await boss.createQueue(QUEUE_NAME, {
      retryLimit: 3,
      retryDelay: 5,
      retryBackoff: true,
    });
    await boss.work(
      QUEUE_NAME,
      { batchSize: 1, includeMetadata: true },
      async (jobs: JobWithMetadata<NotificationJobData>[]) => {
        const job = jobs[0];
        if (job) {
          await this.process(job);
        }
      },
    );
  }

  async enqueue(bookingId: string, kind: NotificationKind): Promise<void> {
    const jobId = await this.pgBossService.boss.send(QUEUE_NAME, {
      bookingId,
      kind,
    });
    this.logger.log(
      `Enqueued ${kind} notification job ${jobId} for booking ${bookingId}`,
    );
  }

  private async process(
    job: JobWithMetadata<NotificationJobData>,
  ): Promise<void> {
    const { bookingId, kind } = job.data;
    this.logger.log(
      `Processing ${kind} notification job ${job.id} for booking ${bookingId} (attempt ${job.retryCount + 1}/${job.retryLimit + 1})`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      // Nothing sensible to retry toward - log and drop rather than fail forever.
      this.logger.warn(
        `Booking ${bookingId} not found for a queued notification job, skipping`,
      );
      return;
    }

    let typed = booking as BookingWithRelations;
    try {
      if (kind === 'confirmed' || kind === 'rescheduled') {
        typed = await this.ensureMeetLink(typed);
      }
      switch (kind) {
        case 'confirmed':
          await this.notificationsService.notifyBookingConfirmed(typed);
          break;
        case 'cancelled':
          await this.notificationsService.notifyBookingCancelled(typed);
          break;
        case 'rescheduled':
          await this.notificationsService.notifyBookingRescheduled(typed);
          break;
      }
      this.logger.log(
        `Sent ${kind} notification emails for booking ${bookingId}`,
      );
    } catch (error) {
      // Covers both steps above (Meet link creation and the email send) --
      // log immediately, with the real error, rather than leaving this only
      // discoverable by querying pgboss.job's `output` column directly --
      // rethrow so pg-boss's own retry/backoff still applies as configured.
      this.logger.error(
        `Failed to process ${kind} notification job for booking ${bookingId} (job ${job.id}, attempt ${job.retryCount + 1}/${job.retryLimit + 1})`,
        error,
      );
      throw error;
    }
  }

  /**
   * Creates the Google Meet event if this booking needs one and doesn't
   * already have it (idempotent, so a retried job after a failed email send
   * won't create a duplicate event). This is the actual failure-prone
   * external API call in the whole notification flow -- keeping it here
   * means a transient Google API error just retries like anything else in
   * this job, instead of failing the client's booking/reschedule request or
   * (worse, as it used to) deleting an otherwise-valid booking outright.
   */
  private async ensureMeetLink(
    booking: BookingWithRelations,
  ): Promise<BookingWithRelations> {
    if (booking.location !== LocationType.GOOGLE_MEET || booking.meetLink) {
      return booking;
    }

    const meet = await this.googleCalendarService.createMeetEvent({
      title: `${booking.eventType.title} — ${booking.clientName}`,
      description: booking.clientNote ?? undefined,
      startAt: booking.startAt,
      endAt: booking.endAt,
      attendeeEmails: [booking.clientEmail, booking.coach.email],
    });
    const updated = await this.prisma.booking.update({
      where: { id: booking.id },
      data: { meetLink: meet.meetLink, googleEventId: meet.eventId },
      include: BOOKING_INCLUDE,
    });
    return updated as BookingWithRelations;
  }
}
