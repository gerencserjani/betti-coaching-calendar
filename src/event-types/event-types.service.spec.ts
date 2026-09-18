import { ConflictException, NotFoundException } from '@nestjs/common';
import { CoachRole, LocationType, type Coach } from '@prisma/client';
import { createTestCoach, createTestEventType } from '../test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EventTypesService } from './event-types.service.js';

describe('EventTypesService (integration)', () => {
  const service = new EventTypesService(testPrisma as unknown as PrismaService);
  let coachA: Coach;
  let coachB: Coach;
  let admin: Coach;

  beforeEach(async () => {
    await resetDatabase();
    coachA = await createTestCoach({ email: 'a@example.com' });
    coachB = await createTestCoach({ email: 'b@example.com' });
    admin = await createTestCoach({
      email: 'admin@example.com',
      role: CoachRole.ADMIN,
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  describe('create', () => {
    it('defaults price to 0 and appends position to the end of the shared catalog', async () => {
      const first = await service.create(coachA, {
        title: 'First',
        durationMinutes: 30,
        locations: [LocationType.PHONE],
      });
      expect(first.price).toBe(0);
      expect(first.position).toBe(0);

      const second = await service.create(coachB, {
        title: 'Second',
        durationMinutes: 45,
        locations: [LocationType.IN_PERSON],
      });
      expect(second.position).toBe(1);
    });

    it('respects an explicitly provided position instead of auto-appending', async () => {
      const eventType = await service.create(coachA, {
        title: 'Explicit position',
        durationMinutes: 30,
        locations: [LocationType.PHONE],
        position: 7,
      });
      expect(eventType.position).toBe(7);
    });
  });

  describe('findActive / findMine', () => {
    it('findActive only returns active event types, ordered by position then title', async () => {
      await createTestEventType(coachA.id, { title: 'Zzz', isActive: true });
      await createTestEventType(coachA.id, { title: 'Aaa', isActive: true });
      await createTestEventType(coachA.id, {
        title: 'Archived',
        isActive: false,
      });

      // The factory doesn't auto-increment position (it writes straight to
      // Prisma, bypassing the service), so both share the schema default of
      // 0 - the tiebreak is then alphabetical by title.
      const active = await service.findActive();
      expect(active).toHaveLength(2);
      expect(active.map((e) => e.title)).toEqual(['Aaa', 'Zzz']);
    });

    it("findMine only returns the given coach's own event types, active or not", async () => {
      await createTestEventType(coachA.id, { title: 'Mine active' });
      await createTestEventType(coachA.id, {
        title: 'Mine archived',
        isActive: false,
      });
      await createTestEventType(coachB.id, { title: 'Not mine' });

      const mine = await service.findMine(coachA.id);
      expect(mine.map((e) => e.title).sort()).toEqual([
        'Mine active',
        'Mine archived',
      ]);
    });
  });

  describe('update', () => {
    it('allows the owning coach to update their own event type', async () => {
      const eventType = await createTestEventType(coachA.id, {
        title: 'Old title',
      });
      const updated = await service.update(coachA, eventType.id, {
        title: 'New title',
      });
      expect(updated.title).toBe('New title');
    });

    it("allows an admin to update any coach's event type", async () => {
      const eventType = await createTestEventType(coachA.id, {
        title: 'Old title',
      });
      const updated = await service.update(admin, eventType.id, {
        title: 'Admin edited',
      });
      expect(updated.title).toBe('Admin edited');
    });

    it("rejects a coach editing another coach's event type", async () => {
      const eventType = await createTestEventType(coachA.id);
      await expect(
        service.update(coachB, eventType.id, { title: 'Hijacked' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('sets isActive to false without deleting the row', async () => {
      const eventType = await createTestEventType(coachA.id);
      const archived = await service.archive(coachA, eventType.id);
      expect(archived.isActive).toBe(false);
      expect(
        await testPrisma.eventType.findUnique({ where: { id: eventType.id } }),
      ).not.toBeNull();
    });
  });

  describe('remove', () => {
    it('permanently deletes an event type with no bookings', async () => {
      const eventType = await createTestEventType(coachA.id);
      await service.remove(coachA, eventType.id);
      expect(
        await testPrisma.eventType.findUnique({ where: { id: eventType.id } }),
      ).toBeNull();
    });

    it('refuses to delete an event type that has a booking, with a clear error', async () => {
      const eventType = await createTestEventType(coachA.id);
      await testPrisma.booking.create({
        data: {
          eventTypeId: eventType.id,
          coachId: coachA.id,
          startAt: new Date('2026-09-21T07:00:00.000Z'),
          endAt: new Date('2026-09-21T07:30:00.000Z'),
          location: LocationType.PHONE,
          clientName: 'Client',
          clientEmail: 'client@example.com',
          clientPhone: '+36301234567',
          manageToken: 'test-manage-token-1',
        },
      });

      await expect(service.remove(coachA, eventType.id)).rejects.toThrow(
        ConflictException,
      );
      expect(
        await testPrisma.eventType.findUnique({ where: { id: eventType.id } }),
      ).not.toBeNull();
    });
  });

  describe('reorder', () => {
    it('applies a full new position ordering atomically', async () => {
      const a = await createTestEventType(coachA.id, { title: 'A' });
      const b = await createTestEventType(coachA.id, { title: 'B' });
      const c = await createTestEventType(coachA.id, { title: 'C' });

      await service.reorder(coachA, [c.id, a.id, b.id]);

      const reread = await testPrisma.eventType.findMany({
        where: { id: { in: [a.id, b.id, c.id] } },
        orderBy: { position: 'asc' },
      });
      expect(reread.map((e) => e.title)).toEqual(['C', 'A', 'B']);
    });

    it("rejects reordering an event type that is not the coach's own", async () => {
      const mine = await createTestEventType(coachA.id);
      const notMine = await createTestEventType(coachB.id);

      await expect(
        service.reorder(coachA, [mine.id, notMine.id]),
      ).rejects.toThrow();
    });
  });
});
