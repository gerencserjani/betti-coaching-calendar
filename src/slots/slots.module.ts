import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';

@Module({
  imports: [AvailabilityModule, SettingsModule],
  controllers: [SlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
