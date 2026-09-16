import { Module } from '@nestjs/common';
import { EventTypesController } from './event-types.controller.js';
import { EventTypesService } from './event-types.service.js';

@Module({
  controllers: [EventTypesController],
  providers: [EventTypesService],
  exports: [EventTypesService],
})
export class EventTypesModule {}
