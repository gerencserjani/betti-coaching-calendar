import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Coach } from '@prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public: the client-facing booking page needs the business address/
  // timezone. See SettingsService.getForPublicRequest for why this is a
  // single-coach stopgap.
  @Get()
  get() {
    return this.settingsService.getForPublicRequest();
  }

  // Any authenticated coach, not just ADMIN: this always updates the
  // caller's own Settings row (resolved from their own coachId), never
  // someone else's, so there's nothing here to restrict by role.
  @ApiBearerAuth()
  @Patch()
  @UseGuards(JwtAuthGuard)
  update(@CurrentCoach() coach: Coach, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(coach.id, dto);
  }
}
