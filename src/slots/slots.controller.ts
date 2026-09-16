import { Controller, Get, Query } from '@nestjs/common';
import { QuerySlotsDto } from './dto/query-slots.dto.js';
import { SlotsService } from './slots.service.js';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  find(@Query() query: QuerySlotsDto) {
    return this.slotsService.computeSlots(query);
  }
}
