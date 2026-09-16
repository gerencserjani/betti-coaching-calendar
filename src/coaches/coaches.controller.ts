import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CoachRole, type Coach } from '@prisma/client';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CoachesService } from './coaches.service.js';
import { CreateCoachDto } from './dto/create-coach.dto.js';
import { UpdateCoachDto } from './dto/update-coach.dto.js';

@ApiTags('coaches')
@ApiBearerAuth()
@Controller('coaches')
@UseGuards(JwtAuthGuard)
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Get()
  findAll() {
    return this.coachesService.findAll();
  }

  @Get('me')
  me(@CurrentCoach() coach: Coach) {
    return coach;
  }

  @Patch('me')
  updateMe(@CurrentCoach() coach: Coach, @Body() dto: UpdateCoachDto) {
    return this.coachesService.update(coach.id, dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(CoachRole.ADMIN)
  create(@Body() dto: CreateCoachDto) {
    return this.coachesService.create(dto);
  }
}
