import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NotificationJobsService } from './notification-jobs.service.js';
import { PgBossService } from './pgboss.service.js';

@Module({
  imports: [NotificationsModule],
  providers: [PgBossService, NotificationJobsService],
  exports: [NotificationJobsService],
})
export class JobsModule {}
