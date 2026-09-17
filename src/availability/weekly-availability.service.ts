import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { runSerializable } from '../common/serializable-transaction.util.js';
import { assertCoachOwnsOrIsAdmin } from '../common/ownership.util.js';
import type { Coach, WeeklyAvailability } from '@prisma/client';
import { AvailabilityService } from './availability.service.js';
import type { CreateWeeklyAvailabilityDto } from './dto/create-weekly-availability.dto.js';
import type { UpdateWeeklyAvailabilityDto } from './dto/update-weekly-availability.dto.js';

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
    // The conflict check (read) and the create (write) run inside the same
    // SERIALIZABLE transaction so two concurrent creates can't both pass the
    // check and commit overlapping availability for different coaches.
    return runSerializable(this.prisma, async (tx) => {
      await this.availabilityService.assertNoCrossCoachConflictForWeekday(
        coach.id,
        dto.weekday,
        dto,
        tx,
      );
      return tx.weeklyAvailability.create({
        data: { ...dto, coachId: coach.id },
      });
    });
  }

  async update(
    coach: Coach,
    id: string,
    dto: UpdateWeeklyAvailabilityDto,
  ): Promise<WeeklyAvailability> {
    const existing = await this.assertOwnership(coach, id);

    const weekday = dto.weekday ?? existing.weekday;
    const startMinute = dto.startMinute ?? existing.startMinute;
    const endMinute = dto.endMinute ?? existing.endMinute;

    this.assertValidRange(startMinute, endMinute);
    return runSerializable(this.prisma, async (tx) => {
      await this.availabilityService.assertNoCrossCoachConflictForWeekday(
        coach.id,
        weekday,
        { startMinute, endMinute },
        tx,
      );
      return tx.weeklyAvailability.update({
        where: { id },
        data: { weekday, startMinute, endMinute },
      });
    });
  }

  async remove(coach: Coach, id: string): Promise<void> {
    await this.assertOwnership(coach, id);
    await this.prisma.weeklyAvailability.delete({ where: { id } });
  }

  private async assertOwnership(
    coach: Coach,
    id: string,
  ): Promise<WeeklyAvailability> {
    const row = await this.prisma.weeklyAvailability.findUnique({
      where: { id },
    });
    return assertCoachOwnsOrIsAdmin(
      coach,
      row,
      'Weekly availability entry not found',
    );
  }

  private assertValidRange(startMinute: number, endMinute: number) {
    if (startMinute >= endMinute) {
      throw new BadRequestException('startMinute must be before endMinute');
    }
  }
}
