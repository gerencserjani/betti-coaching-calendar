import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CoachRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AllowedOriginsService } from './allowed-origins.service.js';
import { CreateAllowedOriginDto } from './dto/create-allowed-origin.dto.js';

// ADMIN-only: this is platform-level CORS configuration, not scoped to any
// one coach -- managed from the admin tool, not any coach's own dashboard.
@ApiTags('allowed-origins')
@ApiBearerAuth()
@Controller('allowed-origins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(CoachRole.ADMIN)
export class AllowedOriginsController {
  constructor(private readonly allowedOriginsService: AllowedOriginsService) {}

  @Get()
  findAll() {
    return this.allowedOriginsService.list();
  }

  @Post()
  create(@Body() dto: CreateAllowedOriginDto) {
    return this.allowedOriginsService.add(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.allowedOriginsService.remove(id);
  }
}
