import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { EmailContentBuilder } from './email-content.builder.js';
import { EmailService } from './email.service.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [SettingsModule],
  providers: [EmailService, EmailContentBuilder, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
