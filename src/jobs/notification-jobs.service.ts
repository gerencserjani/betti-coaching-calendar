import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'pg-boss';
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
      { batchSize: 1 },
      async (jobs: Job<NotificationJobData>[]) => {
        const job = jobs[0];
        if (job) {
          await this.process(job);
        }
      },
    );
  }

  async enqueue(bookingId: string, kind: NotificationKind): Promise<void> {
    await this.pgBossService.boss.send(QUEUE_NAME, { bookingId, kind });
  }

  private async process(job: Job<NotificationJobData>): Promise<void> {
    const { bookingId, kind } = job.data;
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

    const typed = booking as BookingWithRelations;
    switch (kind) {
      case 'confirmed':
        await this.notificationsService.notifyBookingConfirmed(typed);
        return;
      case 'cancelled':
        await this.notificationsService.notifyBookingCancelled(typed);
        return;
      case 'rescheduled':
        await this.notificationsService.notifyBookingRescheduled(typed);
        return;
    }
  }
}
