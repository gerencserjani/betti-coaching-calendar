import { ConflictException, Injectable } from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';
import { PasswordService } from '../auth/password.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageCoach } from '../common/ownership.util.js';
import type { CreateCoachDto } from './dto/create-coach.dto.js';
import type { UpdateCoachDto } from './dto/update-coach.dto.js';

@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Every coach on the caller's shared calendar -- or, for an ADMIN caller
   * (a cross-tenant "super admin"), every coach across every tenant.
   */
  findAll(caller: Coach): Promise<Coach[]> {
    const where =
      caller.role === CoachRole.ADMIN ? {} : { tenantId: caller.tenantId };
    return this.prisma.coach.findMany({ where, orderBy: { name: 'asc' } });
  }

  update(coachId: string, dto: UpdateCoachDto): Promise<Coach> {
    return this.prisma.coach.update({ where: { id: coachId }, data: dto });
  }

  /**
   * ADMIN- or OWNER-only (see RolesGuard on the controller): provision a
   * new coach account. There is no public self-signup. The new coach always
   * gets the plain COACH role and joins the creating actor's own tenant --
   * this never mints another OWNER/ADMIN, so an OWNER can't escalate their
   * own reach through this endpoint. Provisioning a coach into a
   * *different* tenant isn't a need yet (see backend issue #15).
   */
  async create(actor: Coach, dto: CreateCoachDto): Promise<Coach> {
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
        tenantId: actor.tenantId,
      },
    });
  }

  /**
   * See assertCanManageCoach: an ADMIN may revoke anyone's sessions, an
   * OWNER only a plain COACH's within their own tenant.
   */
  async revokeSessions(actor: Coach, coachId: string): Promise<Coach> {
    const target = await this.prisma.coach.findUnique({
      where: { id: coachId },
    });
    assertCanManageCoach(actor, target, 'Coach not found');
    return this.prisma.coach.update({
      where: { id: coachId },
      data: { sessionsRevokedAt: new Date() },
    });
  }
}
