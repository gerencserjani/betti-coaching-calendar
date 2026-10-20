import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CoachInviteEmailService } from './coach-invite-email.service.js';
import { CoachesController } from './coaches.controller.js';
import { CoachesService } from './coaches.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [CoachesController],
  providers: [CoachesService, CoachInviteEmailService],
  exports: [CoachesService],
})
export class CoachesModule {}
