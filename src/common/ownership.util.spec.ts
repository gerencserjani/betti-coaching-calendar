import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CoachRole, type Coach } from '@prisma/client';
import {
  assertCoachOwnsOrIsAdmin,
  resolveCoachScope,
} from './ownership.util.js';

function makeCoach(overrides: Partial<Coach> = {}): Coach {
  return {
    id: 'coach-1',
    email: 'coach@example.com',
    passwordHash: 'hash',
    name: 'Coach',
    preferredLocale: 'hu',
    role: CoachRole.COACH,
    createdAt: new Date(),
    updatedAt: new Date(),
    sessionsRevokedAt: null,
    ...overrides,
  } as Coach;
}

describe('assertCoachOwnsOrIsAdmin', () => {
  it('returns the row when the coach owns it', () => {
    const coach = makeCoach({ id: 'coach-1' });
    const row = { coachId: 'coach-1', title: 'mine' };
    expect(assertCoachOwnsOrIsAdmin(coach, row, 'not found')).toBe(row);
  });

  it('returns the row for an admin, even if owned by someone else', () => {
    const admin = makeCoach({ id: 'admin-1', role: CoachRole.ADMIN });
    const row = { coachId: 'someone-else', title: 'not mine' };
    expect(assertCoachOwnsOrIsAdmin(admin, row, 'not found')).toBe(row);
  });

  it('throws NotFoundException when a non-admin coach does not own the row', () => {
    const coach = makeCoach({ id: 'coach-1', role: CoachRole.COACH });
    const row = { coachId: 'someone-else', title: 'not mine' };
    expect(() => assertCoachOwnsOrIsAdmin(coach, row, 'not found')).toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException (not a different error) when the row is null', () => {
    const coach = makeCoach();
    expect(() => assertCoachOwnsOrIsAdmin(coach, null, 'missing row')).toThrow(
      NotFoundException,
    );
  });
});

describe('resolveCoachScope', () => {
  it('resolves a coach with no requested override to their own id', () => {
    const coach = makeCoach({ id: 'coach-1' });
    expect(resolveCoachScope(coach)).toBe('coach-1');
  });

  it('resolves a coach whose requested coachId matches their own', () => {
    const coach = makeCoach({ id: 'coach-1' });
    expect(resolveCoachScope(coach, 'coach-1')).toBe('coach-1');
  });

  it('rejects a coach requesting a different coachId', () => {
    const coach = makeCoach({ id: 'coach-1' });
    expect(() => resolveCoachScope(coach, 'coach-2')).toThrow(
      ForbiddenException,
    );
  });

  it('resolves an admin with no override to their own id', () => {
    const admin = makeCoach({ id: 'admin-1', role: CoachRole.ADMIN });
    expect(resolveCoachScope(admin)).toBe('admin-1');
  });

  it('lets an admin name any coachId', () => {
    const admin = makeCoach({ id: 'admin-1', role: CoachRole.ADMIN });
    expect(resolveCoachScope(admin, 'coach-2')).toBe('coach-2');
  });
});
