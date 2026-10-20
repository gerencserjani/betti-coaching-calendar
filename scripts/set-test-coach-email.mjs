// Local-testing convenience: coach-facing notification emails always go to
// whatever email is on the coach's own account (that's correct, unchanged
// production behavior) -- this just repoints a locally-seeded test coach
// (e.g. from seed-test-admin.mjs's fake @dev.test address) at a real,
// checkable inbox, read from TEST_COACH_EMAIL in .env so nobody's personal
// address ends up hardcoded/committed anywhere.
//
// Usage: node scripts/set-test-coach-email.mjs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.TEST_COACH_EMAIL;
  if (!email) {
    throw new Error("Set TEST_COACH_EMAIL in .env first.");
  }

  const admin = await prisma.coach.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    throw new Error("No admin coach found -- run a seed script first.");
  }

  const updated = await prisma.coach.update({
    where: { id: admin.id },
    data: { email },
  });
  console.log(`Coach ${updated.id} email set to ${updated.email}`);
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
