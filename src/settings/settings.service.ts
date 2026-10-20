import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Settings } from '@prisma/client';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(coachId: string): Promise<Settings> {
    return this.prisma.settings.upsert({
      where: { coachId },
      create: { coachId },
      update: {},
    });
  }

  async update(coachId: string, dto: UpdateSettingsDto): Promise<Settings> {
    await this.get(coachId);
    return this.prisma.settings.update({
      where: { coachId },
      data: dto,
    });
  }

  /**
   * Stopgap for the public, unauthenticated GET /settings endpoint (see
   * SettingsController): an anonymous request has no coach to resolve yet
   * -- there's no domain/subdomain-based resolution mechanism (see backend
   * issue #14). Returns whichever coach was created first, which is only
   * correct as long as there's exactly one website/coach live. MUST be
   * replaced by real domain-based resolution before a second one goes live.
   */
  async getForPublicRequest(): Promise<Settings> {
    const coach = await this.prisma.coach.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!coach) {
      throw new ServiceUnavailableException('No coach configured yet');
    }
    return this.get(coach.id);
  }
}
