import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  disconnectTestPrisma,
  resetDatabase,
  testPrisma,
} from '../test/prisma-test.util.js';
import { AllowedOriginsService } from './allowed-origins.service.js';

describe('AllowedOriginsService (integration)', () => {
  const prisma = testPrisma as unknown as PrismaService;
  let service: AllowedOriginsService;

  beforeEach(async () => {
    await resetDatabase();
    service = new AllowedOriginsService(prisma);
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  describe('add', () => {
    it('creates an allowed origin', async () => {
      const created = await service.add({
        origin: 'https://peti-coaching.vercel.app',
        label: 'Peti',
      });
      expect(created.origin).toBe('https://peti-coaching.vercel.app');
      expect(created.label).toBe('Peti');
    });

    it('rejects a duplicate origin', async () => {
      await service.add({ origin: 'https://peti-coaching.vercel.app' });
      await expect(
        service.add({ origin: 'https://peti-coaching.vercel.app' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('returns every allowed origin', async () => {
      await service.add({ origin: 'https://a.example.com' });
      await service.add({ origin: 'https://b.example.com' });
      const all = await service.list();
      expect(all.map((o) => o.origin).sort()).toEqual([
        'https://a.example.com',
        'https://b.example.com',
      ]);
    });
  });

  describe('isAllowed', () => {
    it('is false for an origin that was never added', async () => {
      await expect(
        service.isAllowed('https://not-allowed.example.com'),
      ).resolves.toBe(false);
    });

    it('is true for an added origin', async () => {
      await service.add({ origin: 'https://peti-coaching.vercel.app' });
      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(true);
    });

    it('reflects a newly added origin immediately (cache invalidation)', async () => {
      // Prime the cache with an empty result first.
      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(false);

      await service.add({ origin: 'https://peti-coaching.vercel.app' });

      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(true);
    });

    it('reflects a removed origin immediately (cache invalidation)', async () => {
      const created = await service.add({
        origin: 'https://peti-coaching.vercel.app',
      });
      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(true);

      await service.remove(created.id);

      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(false);
    });

    // In production, Cloud Run can run several instances of this service at
    // once, each with its own in-memory cache -- add()/remove() only ever
    // invalidates the instance that handled that call. A write made through
    // a *different* instance (stood in for here by writing via `prisma`
    // directly, bypassing this `service` entirely) is exactly that case.
    it('eventually picks up a write this instance never invalidated for, once the TTL has passed', async () => {
      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(false);

      await prisma.allowedOrigin.create({
        data: { origin: 'https://peti-coaching.vercel.app' },
      });

      // Still stale -- this instance has no way to know yet, within the TTL.
      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(false);

      // Simulates the TTL window having elapsed, without needing fake
      // timers (which risk hanging Prisma's own internal timers).
      (service as unknown as { cachedAt: number }).cachedAt =
        Date.now() - 61_000;

      await expect(
        service.isAllowed('https://peti-coaching.vercel.app'),
      ).resolves.toBe(true);
    });
  });

  describe('remove', () => {
    it('deletes the origin', async () => {
      const created = await service.add({ origin: 'https://a.example.com' });
      await service.remove(created.id);
      const all = await service.list();
      expect(all).toHaveLength(0);
    });
  });
});
