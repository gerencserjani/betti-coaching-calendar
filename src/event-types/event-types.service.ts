import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCoachOwnsOrIsAdmin } from '../common/ownership.util.js';
import { Prisma, type Coach, type EventType } from '@prisma/client';
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
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
    });
  }

  findMine(coachId: string): Promise<EventType[]> {
    return this.prisma.eventType.findMany({
      where: { coachId },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
    });
  }

  async create(coach: Coach, dto: CreateEventTypeDto): Promise<EventType> {
    const position = dto.position ?? (await this.nextPosition());
    return this.prisma.eventType.create({
      data: { ...dto, position, coachId: coach.id },
    });
  }

  /** Appends new event types to the end of the shared catalog's display order by default. */
  private async nextPosition(): Promise<number> {
    const last = await this.prisma.eventType.aggregate({
      _max: { position: true },
    });
    return (last._max.position ?? -1) + 1;
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

  /**
   * Permanently deletes an event type that was never actually booked. The
   * Booking.eventType relation is onDelete: Restrict, so the database itself
   * refuses this if any booking (past or future) still references it --
   * caught here and turned into a clear error instead of a raw 500.
   */
  async remove(coach: Coach, eventTypeId: string): Promise<void> {
    const eventType = await this.assertOwnership(coach, eventTypeId);
    try {
      await this.prisma.eventType.delete({ where: { id: eventType.id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'This service has existing bookings and cannot be permanently deleted -- archive it instead',
        );
      }
      throw error;
    }
  }

  /**
   * Applies a full new display order in one atomic transaction, so a
   * mid-batch failure can't leave some positions updated and others not
   * (which independent per-item PATCH calls from the client could do).
   */
  async reorder(coach: Coach, ids: string[]): Promise<void> {
    const owned = await this.prisma.eventType.findMany({
      where: { id: { in: ids }, coachId: coach.id },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException(
        'One or more event types were not found or are not yours',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.eventType.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
  }

  private async assertOwnership(
    coach: Coach,
    eventTypeId: string,
  ): Promise<EventType> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: eventTypeId },
    });
    return assertCoachOwnsOrIsAdmin(coach, eventType, 'Event type not found');
  }
}
