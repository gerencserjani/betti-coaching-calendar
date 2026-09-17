import { ConflictException, Injectable } from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCoachDto } from './dto/create-coach.dto.js';
import type { UpdateCoachDto } from './dto/update-coach.dto.js';

@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /** All coaches, so anyone can see the shared calendar's full coach roster. */
  findAll(): Promise<Coach[]> {
    return this.prisma.coach.findMany({ orderBy: { name: 'asc' } });
  }

  update(coachId: string, dto: UpdateCoachDto): Promise<Coach> {
    return this.prisma.coach.update({ where: { id: coachId }, data: dto });
  }

  /** Admin-only: provision a new coach account. There is no public self-signup. */
  async create(dto: CreateCoachDto): Promise<Coach> {
    const existing = await this.prisma.coach.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A coach with that email already exists');
    }
    const passwordHash = await this.passwordService.hash(dto.password);
    return this.prisma.coach.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: CoachRole.COACH,
      },
    });
  }

  revokeSessions(coachId: string): Promise<Coach> {
    return this.prisma.coach.update({
      where: { id: coachId },
      data: { sessionsRevokedAt: new Date() },
    });
  }
}
