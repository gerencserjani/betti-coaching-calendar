import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';

const logger = new Logger('OwnershipUtil');

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

/**
 * Resolves which coachId a coach-scoped endpoint should use, from an
 * optional client-supplied `coachId` (e.g. the admin dashboard's
 * VITE_COACH_ID, naming which coach's site this is): a COACH is always
 * pinned to their own id -- a mismatching request is rejected rather than
 * silently redirected, since that's the one case worth being loud about.
 * An ADMIN may name any coach, or fall back to their own id when none is
 * given.
 */
export function resolveCoachScope(
  coach: Coach,
  requestedCoachId?: string,
): string {
  if (coach.role === CoachRole.ADMIN) {
    return requestedCoachId ?? coach.id;
  }
  if (requestedCoachId && requestedCoachId !== coach.id) {
    logger.warn(
      `Coach ${coach.id} attempted to access data scoped to coachId ${requestedCoachId}`,
    );
    throw new ForbiddenException("Cannot access another coach's data");
  }
  return coach.id;
}
