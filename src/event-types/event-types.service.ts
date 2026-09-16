import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoachRole, type Coach, type EventType } from '@prisma/client';
import type { CreateEventTypeDto } from './dto/create-event-type.dto.js';
import type { UpdateEventTypeDto } from './dto/update-event-type.dto.js';

@Injectable()
export class EventTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalog: every active event type, for the client-facing booking UI. */
  findActive(): Promise<EventType[]> {
    return this.prisma.eventType.findMany({
      where: { isActive: true },
      include: { coach: { select: { id: true, name: true } } },
      orderBy: { title: 'asc' },
    });
  }

  findMine(coachId: string): Promise<EventType[]> {
    return this.prisma.eventType.findMany({
      where: { coachId },
      orderBy: { title: 'asc' },
    });
  }

  create(coach: Coach, dto: CreateEventTypeDto): Promise<EventType> {
    return this.prisma.eventType.create({
      data: { ...dto, coachId: coach.id },
    });
  }

  async update(
    coach: Coach,
    eventTypeId: string,
    dto: UpdateEventTypeDto,
  ): Promise<EventType> {
    const eventType = await this.assertOwnership(coach, eventTypeId);
    return this.prisma.eventType.update({
      where: { id: eventType.id },
      data: dto,
    });
  }

  /** Archives instead of deleting, so past bookings keep a valid EventType to reference. */
  async archive(coach: Coach, eventTypeId: string): Promise<EventType> {
    const eventType = await this.assertOwnership(coach, eventTypeId);
    return this.prisma.eventType.update({
      where: { id: eventType.id },
      data: { isActive: false },
    });
  }

  private async assertOwnership(
    coach: Coach,
    eventTypeId: string,
  ): Promise<EventType> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: eventTypeId },
    });
    if (!eventType) {
      throw new NotFoundException('Event type not found');
    }
    if (eventType.coachId !== coach.id && coach.role !== CoachRole.ADMIN) {
      throw new ForbiddenException('Not the owner of this event type');
    }
    return eventType;
  }
}
