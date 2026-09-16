import { SetMetadata } from '@nestjs/common';
import type { CoachRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: CoachRole[]) => SetMetadata(ROLES_KEY, roles);
