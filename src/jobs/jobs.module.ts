import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NotificationJobsService } from './notification-jobs.service.js';
import { PgBossService } from './pgboss.service.js';

@Module({
  imports: [NotificationsModule, GoogleModule],
  providers: [PgBossService, NotificationJobsService],
  exports: [NotificationJobsService],
})
export class JobsModule {}
