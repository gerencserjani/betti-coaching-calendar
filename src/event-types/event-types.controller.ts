import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Coach } from '@prisma/client';
import { CreateEventTypeDto } from './dto/create-event-type.dto.js';
import { UpdateEventTypeDto } from './dto/update-event-type.dto.js';
import { EventTypesService } from './event-types.service.js';

@Controller('event-types')
export class EventTypesController {
  constructor(private readonly eventTypesService: EventTypesService) {}

  @Get()
  findActive() {
    return this.eventTypesService.findActive();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentCoach() coach: Coach) {
    return this.eventTypesService.findMine(coach.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentCoach() coach: Coach, @Body() dto: CreateEventTypeDto) {
    return this.eventTypesService.create(coach, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentCoach() coach: Coach,
    @Param('id') id: string,
    @Body() dto: UpdateEventTypeDto,
  ) {
    return this.eventTypesService.update(coach, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  archive(@CurrentCoach() coach: Coach, @Param('id') id: string) {
    return this.eventTypesService.archive(coach, id);
  }
}
