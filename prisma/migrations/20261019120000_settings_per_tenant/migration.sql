-- Settings becomes a per-Tenant row (1:1 extension of Tenant, keyed
-- directly by tenantId) instead of a single fixed "singleton" row.
-- Hand-written, not raw `prisma migrate dev` output: moving a NOT NULL
-- primary key from `id` to a new `tenantId` column needs a backfill step
-- (there's exactly one Tenant today, from the #11 migration, so every
-- existing Settings row belongs to it) before the old column can be
-- dropped and the new one promoted to primary key.

-- AlterTable (nullable first, so the backfill below can run)
ALTER TABLE "Settings" ADD COLUMN "tenantId" TEXT;

-- Backfill: the one Settings row that exists today belongs to the one
-- Tenant that exists today (see the #11 migration's 'default-tenant').
UPDATE "Settings" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;

-- Now safe to enforce NOT NULL.
ALTER TABLE "Settings" ALTER COLUMN "tenantId" SET NOT NULL;

-- Swap the primary key from "id" to "tenantId".
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_pkey";
ALTER TABLE "Settings" DROP COLUMN "id";
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_pkey" PRIMARY KEY ("tenantId");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
