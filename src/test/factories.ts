import bcrypt from 'bcryptjs';
import {
  CoachRole,
  LocationType,
  type AllowedOrigin,
  type Coach,
  type EventType,
} from '@prisma/client';
import { testPrisma } from './prisma-test.util.js';

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createTestCoach(
  overrides: Partial<{
    email: string;
    name: string;
    role: CoachRole;
    password: string;
    frontendUrl: string | null;
  }> = {},
): Promise<Coach> {
  const passwordHash = await bcrypt.hash(
    overrides.password ?? 'test-password-123',
    4,
  );
  return testPrisma.coach.create({
    data: {
      email: overrides.email ?? `${unique('coach')}@example.com`,
      name: overrides.name ?? 'Test Coach',
      passwordHash,
      role: overrides.role ?? CoachRole.COACH,
      frontendUrl: overrides.frontendUrl,
    },
  });
}

export async function createTestAllowedOrigin(
  overrides: Partial<{ origin: string }> = {},
): Promise<AllowedOrigin> {
  return testPrisma.allowedOrigin.create({
    data: {
      origin: overrides.origin ?? `https://${unique('site')}.example.com`,
    },
  });
}

export async function createTestEventType(
  coachId: string,
  overrides: Partial<{
    title: string;
    durationMinutes: number;
    locations: LocationType[];
    price: number | null;
    isActive: boolean;
  }> = {},
): Promise<EventType> {
  return testPrisma.eventType.create({
    data: {
      coachId,
      title: overrides.title ?? unique('Event Type'),
      durationMinutes: overrides.durationMinutes ?? 30,
      locations: overrides.locations ?? [LocationType.PHONE],
      price: overrides.price ?? null,
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
