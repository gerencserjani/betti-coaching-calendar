import bcrypt from 'bcryptjs';
import {
  CoachRole,
  LocationType,
  type Coach,
  type EventType,
  type Tenant,
} from '@prisma/client';
import { testPrisma } from './prisma-test.util.js';

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createTestTenant(
  overrides: Partial<{ name: string }> = {},
): Promise<Tenant> {
  return testPrisma.tenant.create({
    data: { name: overrides.name ?? unique('Test Tenant') },
  });
}

/**
 * Defaults to a fresh Tenant per call, so independent tests don't
 * accidentally share a calendar. Pass `tenantId` explicitly (reusing one
 * `createTestTenant()` result) whenever a test actually wants two coaches on
 * the same shared calendar -- e.g. cross-coach availability-conflict tests.
 */
export async function createTestCoach(
  overrides: Partial<{
    email: string;
    name: string;
    role: CoachRole;
    password: string;
    tenantId: string;
  }> = {},
): Promise<Coach> {
  const passwordHash = await bcrypt.hash(
    overrides.password ?? 'test-password-123',
    4,
  );
  const tenantId = overrides.tenantId ?? (await createTestTenant()).id;
  return testPrisma.coach.create({
    data: {
      email: overrides.email ?? `${unique('coach')}@example.com`,
      name: overrides.name ?? 'Test Coach',
      passwordHash,
      role: overrides.role ?? CoachRole.COACH,
      tenantId,
    },
  });
}

export async function createTestEventType(
  coachId: string,
  overrides: Partial<{
    title: string;
    durationMinutes: number;
    locations: LocationType[];
    price: number;
    isActive: boolean;
  }> = {},
): Promise<EventType> {
  return testPrisma.eventType.create({
    data: {
      coachId,
      title: overrides.title ?? unique('Event Type'),
      durationMinutes: overrides.durationMinutes ?? 30,
      locations: overrides.locations ?? [LocationType.PHONE],
      price: overrides.price ?? 0,
      isActive: overrides.isActive ?? true,
    },
  });
}

/** Full-week 09:00-17:00 availability, so slot/booking tests don't need to reason about which weekday "today" is. */
export async function createFullWeekAvailability(
  coachId: string,
): Promise<void> {
  for (let weekday = 1; weekday <= 7; weekday++) {
    await testPrisma.weeklyAvailability.create({
      data: { coachId, weekday, startMinute: 0, endMinute: 24 * 60 },
    });
  }
}
