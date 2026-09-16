import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuerySlotsDto } from './dto/query-slots.dto.js';
import { SlotsService } from './slots.service.js';

@ApiTags('slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  find(@Query() query: QuerySlotsDto) {
    return this.slotsService.computeSlots(query);
  }
}
