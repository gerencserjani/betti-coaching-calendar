import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, type Settings } from '@prisma/client';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { isValidEmailBrandPalette } from './email-brand-palette.util.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts on read, so a brand-new coach gets sensible defaults instead of
   * a 404 the first time anything asks for their Settings. Checks the coach
   * actually exists first -- without it, an unknown coachId (bad input on
   * the public endpoint, see SettingsController) would hit Settings'
   * foreign key constraint and surface as a raw 500 instead of a clean 404.
   */
  async get(coachId: string): Promise<Settings> {
    const coach = await this.prisma.coach.findUnique({
      where: { id: coachId },
      select: { id: true },
    });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    return this.prisma.settings.upsert({
      where: { coachId },
      create: { coachId },
      update: {},
    });
  }

  async update(coachId: string, dto: UpdateSettingsDto): Promise<Settings> {
    await this.get(coachId);
    if (
      dto.emailBrandPalette != null &&
      !isValidEmailBrandPalette(dto.emailBrandPalette)
    ) {
      throw new BadRequestException(
        'emailBrandPalette must have light/dark objects, each with hex color values for bg, bgPanel, bgCard, ink, inkSoft, accent, accentSoft, line, brown',
      );
    }
    const updated = await this.prisma.settings.update({
      where: { coachId },
      // Prisma's typed Json field update requires the Prisma.JsonNull
      // sentinel to set it to SQL NULL -- a plain `null` is only valid for
      // non-Json fields, so this can't just be `data: dto`.
      data: {
        ...dto,
        emailBrandPalette:
          dto.emailBrandPalette === null
            ? Prisma.JsonNull
            : (dto.emailBrandPalette as Prisma.InputJsonValue | undefined),
      },
    });
    this.logger.log(`Updated settings for coach ${coachId}`);
    return updated;
  }
}
