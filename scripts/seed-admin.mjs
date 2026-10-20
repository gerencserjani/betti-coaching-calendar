// One-off, interactive script: creates the single admin account directly in
// the database. Deliberately NOT env-var driven - the admin's email/password
// are typed once here and only ever stored as a bcrypt hash, never written
// to any .env/env.yaml file.
//
// Usage (against whichever DATABASE_URL is active):
//   node scripts/seed-admin.mjs
// Against production: run it locally with the Neon connection string, e.g.
//   DATABASE_URL="postgresql://...neon..." node scripts/seed-admin.mjs

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingAdmin = await prisma.coach.findFirst({
    where: { role: 'ADMIN' },
  });
  if (existingAdmin) {
    console.log(
      `An admin already exists (${existingAdmin.email}). Nothing to do.`,
    );
    console.log('Delete that row first if you really want to reseed.');
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  console.log('Creating the admin account. The password is typed here only -');
  console.log(
    "it's hashed immediately and never saved anywhere in plain text.",
  );
  console.log(
    '(input stays visible as you type - make sure nobody is watching)\n',
  );

  const email = await rl.question('Admin email: ');
  const name = await rl.question('Admin name: ');
  const password = await rl.question('Admin password (min 8 chars): ');
  rl.close();

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.coach.create({
    data: { email, name, passwordHash, role: 'ADMIN' },
  });
  console.log(`\nCreated admin: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
