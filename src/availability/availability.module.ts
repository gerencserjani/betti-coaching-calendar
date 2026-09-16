import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { AvailabilityOverrideService } from './availability-override.service.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import { WeeklyAvailabilityService } from './weekly-availability.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [AvailabilityController],
  providers: [
    AvailabilityService,
    WeeklyAvailabilityService,
    AvailabilityOverrideService,
  ],
  exports: [
    AvailabilityService,
    WeeklyAvailabilityService,
    AvailabilityOverrideService,
  ],
})
export class AvailabilityModule {}
