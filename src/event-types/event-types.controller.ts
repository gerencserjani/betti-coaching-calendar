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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Coach } from '@prisma/client';
import { CreateEventTypeDto } from './dto/create-event-type.dto.js';
import { ReorderEventTypesDto } from './dto/reorder-event-types.dto.js';
import { UpdateEventTypeDto } from './dto/update-event-type.dto.js';
import { EventTypesService } from './event-types.service.js';

@ApiTags('event-types')
@Controller('event-types')
export class EventTypesController {
  constructor(private readonly eventTypesService: EventTypesService) {}

  // Public: the client-facing booking catalog.
  @Get()
  findActive() {
    return this.eventTypesService.findActive();
  }

  @ApiBearerAuth()
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentCoach() coach: Coach) {
    return this.eventTypesService.findMine(coach.id);
  }

  @ApiBearerAuth()
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentCoach() coach: Coach, @Body() dto: CreateEventTypeDto) {
    return this.eventTypesService.create(coach, dto);
  }

  // Declared before ':id' so Nest doesn't match "reorder" as an :id param.
  @ApiBearerAuth()
  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  reorder(@CurrentCoach() coach: Coach, @Body() dto: ReorderEventTypesDto) {
    return this.eventTypesService.reorder(coach, dto.ids);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentCoach() coach: Coach,
    @Param('id') id: string,
    @Body() dto: UpdateEventTypeDto,
  ) {
    return this.eventTypesService.update(coach, id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  archive(@CurrentCoach() coach: Coach, @Param('id') id: string) {
    return this.eventTypesService.archive(coach, id);
  }

  // Permanent delete, distinct from archive above -- only succeeds if the
  // event type was never actually booked (see EventTypesService.remove).
  @ApiBearerAuth()
  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentCoach() coach: Coach, @Param('id') id: string) {
    return this.eventTypesService.remove(coach, id);
  }
}
