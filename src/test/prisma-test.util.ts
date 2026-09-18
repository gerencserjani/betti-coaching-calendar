import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** Shared Prisma client for integration/e2e tests, pointed at the dedicated test database (.env.test). */
export const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Truncates every app-owned table between tests, in FK-safe order, and
 * resets the Settings/GoogleIntegration singletons. Leaves pg-boss's own
 * schema alone - individual job tests clean up after themselves.
 */
export async function resetDatabase(): Promise<void> {
  await testPrisma.booking.deleteMany();
  await testPrisma.availabilityOverride.deleteMany();
  await testPrisma.weeklyAvailability.deleteMany();
  await testPrisma.eventType.deleteMany();
  await testPrisma.coach.deleteMany();
  await testPrisma.settings.deleteMany();
  await testPrisma.googleIntegration.deleteMany();
}

export async function disconnectTestPrisma(): Promise<void> {
  await testPrisma.$disconnect();
}
