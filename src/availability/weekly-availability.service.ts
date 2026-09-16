import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoachRole, type Coach, type WeeklyAvailability } from '@prisma/client';
import { AvailabilityService } from './availability.service.js';
import type { CreateWeeklyAvailabilityDto } from './dto/create-weekly-availability.dto.js';

@Injectable()
export class WeeklyAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  findForCoach(coachId: string): Promise<WeeklyAvailability[]> {
    return this.prisma.weeklyAvailability.findMany({
      where: { coachId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
  }

  async create(
    coach: Coach,
    dto: CreateWeeklyAvailabilityDto,
  ): Promise<WeeklyAvailability> {
    this.assertValidRange(dto.startMinute, dto.endMinute);
    await this.availabilityService.assertNoCrossCoachConflictForWeekday(
      coach.id,
      dto.weekday,
      dto,
    );

    return this.prisma.weeklyAvailability.create({
      data: { ...dto, coachId: coach.id },
    });
  }

  async remove(coach: Coach, id: string): Promise<void> {
    const row = await this.prisma.weeklyAvailability.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Weekly availability entry not found');
    }
    if (row.coachId !== coach.id && coach.role !== CoachRole.ADMIN) {
      throw new NotFoundException('Weekly availability entry not found');
    }
    await this.prisma.weeklyAvailability.delete({ where: { id } });
  }

  private assertValidRange(startMinute: number, endMinute: number) {
    if (startMinute >= endMinute) {
      throw new BadRequestException('startMinute must be before endMinute');
    }
  }
}
