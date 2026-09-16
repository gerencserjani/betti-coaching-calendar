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
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Coach } from '@prisma/client';
import { BookingsService } from './bookings.service.js';
import {
  ClientCancelBookingDto,
  CoachCancelBookingDto,
} from './dto/cancel-booking.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @ApiBearerAuth()
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.bookingsService.findAll();
  }

  // Public: the client-facing booking form.
  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  // Public: reached via the random manageToken emailed to the client, no login.
  @Get('manage/:token')
  findByToken(@Param('token') token: string) {
    return this.bookingsService.findByManageToken(token);
  }

  @Patch('manage/:token/cancel')
  cancelByClient(
    @Param('token') token: string,
    @Body() dto: ClientCancelBookingDto,
  ) {
    return this.bookingsService.cancelByClient(token, dto);
  }

  @Patch('manage/:token/reschedule')
  rescheduleByClient(
    @Param('token') token: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.rescheduleByClient(token, dto);
  }

  @ApiBearerAuth()
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelByCoach(
    @CurrentCoach() coach: Coach,
    @Param('id') id: string,
    @Body() dto: CoachCancelBookingDto,
  ) {
    return this.bookingsService.cancelByCoach(coach, id, dto);
  }
}
