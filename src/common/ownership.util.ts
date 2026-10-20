import { NotFoundException } from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';

/**
 * Standard ownership check for coach-scoped resources: an admin can act on
 * anything, a coach only on their own. Returns NotFoundException for BOTH a
 * missing row and a row owned by someone else -- a 403 would confirm the id
 * exists to someone who isn't allowed to see it.
 */
export function assertCoachOwnsOrIsAdmin<T extends { coachId: string }>(
  coach: Coach,
  row: T | null,
  notFoundMessage: string,
): T {
  if (!row || (row.coachId !== coach.id && coach.role !== CoachRole.ADMIN)) {
    throw new NotFoundException(notFoundMessage);
  }
  return row;
}
