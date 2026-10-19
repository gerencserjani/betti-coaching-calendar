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

/**
 * Account-management check for acting on *another coach's account itself*
 * (create/revoke-sessions/...), as opposed to assertCoachOwnsOrIsAdmin above,
 * which is about a coach's calendar/event-type/etc. resources. An OWNER
 * deliberately does NOT get the same reach as an ADMIN here: only the plain
 * COACH role, only within the OWNER's own tenant, and never another OWNER's
 * or an ADMIN's account -- an OWNER never touches another coach's calendar
 * at all, only their account (see CoachRole in schema.prisma).
 */
export function assertCanManageCoach(
  actor: Coach,
  target: Coach | null,
  notFoundMessage: string,
): Coach {
  const allowed =
    !!target &&
    (actor.role === CoachRole.ADMIN ||
      (actor.role === CoachRole.OWNER &&
        target.role === CoachRole.COACH &&
        target.tenantId === actor.tenantId));
  if (!allowed) {
    throw new NotFoundException(notFoundMessage);
  }
  return target!;
}
