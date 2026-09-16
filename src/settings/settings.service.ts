import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Settings } from '@prisma/client';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

const SETTINGS_ID = 'singleton';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Settings> {
    return this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto): Promise<Settings> {
    await this.get();
    return this.prisma.settings.update({
      where: { id: SETTINGS_ID },
      data: dto,
    });
  }
}
