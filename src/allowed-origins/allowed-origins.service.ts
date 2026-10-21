import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { AllowedOrigin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAllowedOriginDto } from './dto/create-allowed-origin.dto.js';

// Bounds how stale this cache can get on a *different* Cloud Run instance
// than the one an add()/remove() call happened to land on -- see isAllowed()
// below. Short enough that a newly allow-listed origin works everywhere
// within a minute even in that case; long enough that CORS checks still hit
// memory, not Postgres, on nearly every request.
const CACHE_TTL_MS = 60_000;

@Injectable()
export class AllowedOriginsService {
  private readonly logger = new Logger(AllowedOriginsService.name);

  // Invalidated immediately on add/remove -- but only *on this instance*.
  // Cloud Run can run several instances of this service at once, each with
  // its own copy of this cache; add()/remove() on one instance has no way
  // to reach the others, so without the TTL below, a different instance
  // that already has a warm cache would keep serving a stale allow-list
  // indefinitely instead of just until its next natural restart. null means
  // "not loaded yet", distinct from an empty Set.
  private cache: Set<string> | null = null;
  private cachedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<AllowedOrigin[]> {
    return this.prisma.allowedOrigin.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(dto: CreateAllowedOriginDto): Promise<AllowedOrigin> {
    const existing = await this.prisma.allowedOrigin.findUnique({
      where: { origin: dto.origin },
    });
    if (existing) {
      throw new ConflictException('That origin is already allowed');
    }
    const created = await this.prisma.allowedOrigin.create({
      data: { origin: dto.origin, label: dto.label },
    });
    this.cache = null;
    this.logger.log(`Allowed origin added: ${created.origin}`);
    return created;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.prisma.allowedOrigin.delete({ where: { id } });
    this.cache = null;
    this.logger.log(`Allowed origin removed: ${removed.origin}`);
  }

  /** Used by main.ts's CORS origin callback -- see isLocalhostOrigin for the separate, always-on localhost exception. */
  async isAllowed(origin: string): Promise<boolean> {
    if (!this.cache || Date.now() - this.cachedAt > CACHE_TTL_MS) {
      const rows = await this.prisma.allowedOrigin.findMany({
        select: { origin: true },
      });
      this.cache = new Set(rows.map((row) => row.origin));
      this.cachedAt = Date.now();
    }
    return this.cache.has(origin);
  }
}
