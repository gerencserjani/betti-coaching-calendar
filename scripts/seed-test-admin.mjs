// Temporary, non-interactive dev-only seed script for local testing.
// NOT for production use -- mirrors seed-admin.mjs's logic with hardcoded
// test credentials so the frontend admin UI can be verified end-to-end.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("dev-test-password-123", 12);
  const admin = await prisma.coach.upsert({
    where: { email: "admin@dev.test" },
    update: {},
    create: {
      email: "admin@dev.test",
      name: "Teszt Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin ready: ${admin.email} / dev-test-password-123`);

  const eventType = await prisma.eventType.upsert({
    where: { id: "dev-test-event-type" },
    update: {},
    create: {
      id: "dev-test-event-type",
      coachId: admin.id,
      title: "Teszt konzultáció",
      description: "Egy rövid teszt esemény a fejlesztéshez.",
      durationMinutes: 60,
      locations: ["GOOGLE_MEET", "PHONE"],
    },
  });
  console.log(`Event type ready: ${eventType.title}`);

  await prisma.weeklyAvailability.deleteMany({ where: { coachId: admin.id } });
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.weeklyAvailability.create({
      data: { coachId: admin.id, weekday, startMinute: 9 * 60, endMinute: 17 * 60 },
    });
  }
  console.log("Weekly availability ready: Mon-Fri 09:00-17:00");
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
