import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
  findAll(@CurrentCoach() coach: Coach) {
    return this.coachesService.findAll(coach);
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
  @Roles(CoachRole.ADMIN, CoachRole.OWNER)
  create(@CurrentCoach() actor: Coach, @Body() dto: CreateCoachDto) {
    return this.coachesService.create(actor, dto);
  }

  // Forces the target coach to log in again on every device: any access
  // token issued before now stops working immediately (see JwtAuthGuard).
  // The only lever available for a leaked token or an offboarded coach,
  // since tokens are otherwise valid for their full 30-day TTL.
  @Patch(':id/revoke-sessions')
  @UseGuards(RolesGuard)
  @Roles(CoachRole.ADMIN, CoachRole.OWNER)
  revokeSessions(@CurrentCoach() actor: Coach, @Param('id') id: string) {
    return this.coachesService.revokeSessions(actor, id);
  }
}
