import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Settings } from '@prisma/client';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<Settings> {
    return this.prisma.settings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async update(tenantId: string, dto: UpdateSettingsDto): Promise<Settings> {
    await this.get(tenantId);
    return this.prisma.settings.update({
      where: { tenantId },
      data: dto,
    });
  }

  /**
   * Stopgap for the public, unauthenticated GET /settings endpoint (see
   * SettingsController): an anonymous request has no tenant to resolve yet
   * -- there's no domain/subdomain-based tenant resolution mechanism (see
   * backend issue #14). Returns whichever tenant was created first, which
   * is only correct as long as there's exactly one tenant. MUST be
   * replaced by real tenant resolution before a second tenant goes live.
   */
  async getForPublicRequest(): Promise<Settings> {
    const tenant = await this.prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!tenant) {
      throw new ServiceUnavailableException('No tenant configured yet');
    }
    return this.get(tenant.id);
  }
}
