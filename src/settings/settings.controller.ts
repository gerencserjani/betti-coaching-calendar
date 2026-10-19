import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CoachRole, type Coach } from '@prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public: the client-facing booking page needs the business address/
  // timezone. See SettingsService.getForPublicRequest for why this is a
  // single-tenant stopgap.
  @Get()
  get() {
    return this.settingsService.getForPublicRequest();
  }

  // OWNER gets this too: Settings is tenant-wide business config (address,
  // cancellation policy, timezone), not another coach's calendar/account --
  // the restriction that keeps an OWNER off other coaches' resources
  // doesn't apply here.
  @ApiBearerAuth()
  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN, CoachRole.OWNER)
  update(@CurrentCoach() coach: Coach, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(coach.tenantId, dto);
  }
}
