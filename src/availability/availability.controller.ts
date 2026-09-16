import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Coach } from '@prisma/client';
import { AvailabilityOverrideService } from './availability-override.service.js';
import { CreateAvailabilityOverrideDto } from './dto/create-availability-override.dto.js';
import { CreateWeeklyAvailabilityDto } from './dto/create-weekly-availability.dto.js';
import { WeeklyAvailabilityService } from './weekly-availability.service.js';

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(
    private readonly weeklyService: WeeklyAvailabilityService,
    private readonly overrideService: AvailabilityOverrideService,
  ) {}

  @Get('weekly')
  findMyWeekly(@CurrentCoach() coach: Coach) {
    return this.weeklyService.findForCoach(coach.id);
  }

  @Post('weekly')
  createWeekly(
    @CurrentCoach() coach: Coach,
    @Body() dto: CreateWeeklyAvailabilityDto,
  ) {
    return this.weeklyService.create(coach, dto);
  }

  @Delete('weekly/:id')
  removeWeekly(@CurrentCoach() coach: Coach, @Param('id') id: string) {
    return this.weeklyService.remove(coach, id);
  }

  @Get('overrides')
  findMyOverrides(@CurrentCoach() coach: Coach) {
    return this.overrideService.findForCoach(coach.id);
  }

  @Post('overrides')
  createOverride(
    @CurrentCoach() coach: Coach,
    @Body() dto: CreateAvailabilityOverrideDto,
  ) {
    return this.overrideService.create(coach, dto);
  }

  @Delete('overrides/:id')
  removeOverride(@CurrentCoach() coach: Coach, @Param('id') id: string) {
    return this.overrideService.remove(coach, id);
  }
}
