import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { GoogleModule } from '../google/google.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [AvailabilityModule, SettingsModule, GoogleModule, JobsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
