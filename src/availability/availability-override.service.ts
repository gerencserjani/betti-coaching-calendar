import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  CoachRole,
  type AvailabilityOverride,
  type Coach,
} from '@prisma/client';
import { AvailabilityService, toDateOnly } from './availability.service.js';
import type { CreateAvailabilityOverrideDto } from './dto/create-availability-override.dto.js';

@Injectable()
export class AvailabilityOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly settingsService: SettingsService,
  ) {}

  findForCoach(coachId: string): Promise<AvailabilityOverride[]> {
    return this.prisma.availabilityOverride.findMany({
      where: { coachId },
      orderBy: { date: 'asc' },
    });
  }

  async create(
    coach: Coach,
    dto: CreateAvailabilityOverrideDto,
  ): Promise<AvailabilityOverride> {
    const isUnavailable = dto.isUnavailable ?? false;

    if (!isUnavailable) {
      if (dto.startMinute === undefined || dto.endMinute === undefined) {
        throw new BadRequestException(
          'startMinute and endMinute are required unless isUnavailable is true',
        );
      }
      if (dto.startMinute >= dto.endMinute) {
        throw new BadRequestException('startMinute must be before endMinute');
      }

      const settings = await this.settingsService.get();
      await this.availabilityService.assertNoCrossCoachConflictForDate(
        coach.id,
        dto.date,
        settings.businessTimezone,
        { startMinute: dto.startMinute, endMinute: dto.endMinute },
      );
    }

    return this.prisma.availabilityOverride.create({
      data: {
        coachId: coach.id,
        date: toDateOnly(dto.date),
        isUnavailable,
        startMinute: isUnavailable ? null : dto.startMinute,
        endMinute: isUnavailable ? null : dto.endMinute,
      },
    });
  }

  async remove(coach: Coach, id: string): Promise<void> {
    const row = await this.prisma.availabilityOverride.findUnique({
      where: { id },
    });
    if (!row || (row.coachId !== coach.id && coach.role !== CoachRole.ADMIN)) {
      throw new NotFoundException('Availability override not found');
    }
    await this.prisma.availabilityOverride.delete({ where: { id } });
  }
}
