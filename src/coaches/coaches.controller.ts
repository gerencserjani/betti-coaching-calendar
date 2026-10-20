import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CoachRole, type Coach } from '@prisma/client';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CoachesService } from './coaches.service.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { InviteCoachDto } from './dto/invite-coach.dto.js';
import { UpdateCoachDto } from './dto/update-coach.dto.js';

@ApiTags('coaches')
@Controller('coaches')
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @ApiBearerAuth()
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN)
  findAll() {
    return this.coachesService.findAll();
  }

  @ApiBearerAuth()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentCoach() coach: Coach) {
    return coach;
  }

  @ApiBearerAuth()
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentCoach() coach: Coach, @Body() dto: UpdateCoachDto) {
    return this.coachesService.update(coach.id, dto);
  }

  @ApiBearerAuth()
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  changePassword(@CurrentCoach() coach: Coach, @Body() dto: ChangePasswordDto) {
    return this.coachesService.changePassword(coach, dto);
  }

  // Invites a brand-new coach -- see CoachesService.invite() for why this
  // doesn't create a Coach row yet. Calling it again for the same email
  // (e.g. the first invite email got lost) just sends a fresh link.
  @ApiBearerAuth()
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN)
  @HttpCode(204)
  invite(@Body() dto: InviteCoachDto) {
    return this.coachesService.invite(dto);
  }

  // Public: the coach has no session yet -- this is how they get one, by
  // proving (via the signed token) that they received the invite email.
  // Throttled like login/booking-create: an unauthenticated mutation that
  // sends back a working access token is worth rate-limiting even though
  // the token itself isn't realistically guessable.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.coachesService.acceptInvite(dto);
  }

  // Forces the target coach to log in again on every device: any access
  // token issued before now stops working immediately (see JwtAuthGuard).
  // The only lever available for a leaked token or an offboarded coach,
  // since tokens are otherwise valid for their full 30-day TTL.
  @ApiBearerAuth()
  @Patch(':id/revoke-sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN)
  revokeSessions(@Param('id') id: string) {
    return this.coachesService.revokeSessions(id);
  }
}
