import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { AllowedOrigin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAllowedOriginDto } from './dto/create-allowed-origin.dto.js';

@Injectable()
export class AllowedOriginsService {
  private readonly logger = new Logger(AllowedOriginsService.name);

  // Invalidated immediately on add/remove (not a polling/TTL cache) -- see
  // isAllowed(). null means "not loaded yet", distinct from an empty Set.
  private cache: Set<string> | null = null;

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
    if (!this.cache) {
      const rows = await this.prisma.allowedOrigin.findMany({
        select: { origin: true },
      });
      this.cache = new Set(rows.map((row) => row.origin));
    }
    return this.cache.has(origin);
  }
}
