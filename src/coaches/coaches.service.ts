import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCoachDto } from './dto/create-coach.dto.js';
import type { UpdateCoachDto } from './dto/update-coach.dto.js';

@Injectable()
export class CoachesService {
  private readonly logger = new Logger(CoachesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /** ADMIN-only (see RolesGuard on the controller): every coach/business on the platform. */
  findAll(): Promise<Coach[]> {
    return this.prisma.coach.findMany({ orderBy: { name: 'asc' } });
  }

  update(coachId: string, dto: UpdateCoachDto): Promise<Coach> {
    return this.prisma.coach.update({ where: { id: coachId }, data: dto });
  }

  /** ADMIN-only: provision a brand-new coach/business. There is no public self-signup. */
  async create(dto: CreateCoachDto): Promise<Coach> {
    const existing = await this.prisma.coach.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A coach with that email already exists');
    }
    const passwordHash = await this.passwordService.hash(dto.password);
    const coach = await this.prisma.coach.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: CoachRole.COACH,
      },
    });
    this.logger.log(`Created coach ${coach.id} (${coach.email})`);
    return coach;
  }

  /** ADMIN-only. */
  async revokeSessions(coachId: string): Promise<Coach> {
    const coach = await this.prisma.coach.update({
      where: { id: coachId },
      data: { sessionsRevokedAt: new Date() },
    });
    this.logger.warn(`Revoked all sessions for coach ${coachId}`);
    return coach;
  }
}
