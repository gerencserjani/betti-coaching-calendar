-- GoogleIntegration becomes a per-Tenant row (1:1 extension of Tenant,
-- keyed directly by tenantId) instead of a single fixed "singleton" row --
-- same shape and reasoning as the earlier Settings-per-tenant migration.
-- Hand-written: moving a NOT NULL primary key from `id` to a new
-- `tenantId` column needs a backfill step (there's exactly one Tenant
-- today, from the #11 migration, so the one existing GoogleIntegration row,
-- if any, belongs to it) before the old column can be dropped and the new
-- one promoted to primary key.

-- AlterTable (nullable first, so the backfill below can run)
ALTER TABLE "GoogleIntegration" ADD COLUMN "tenantId" TEXT;

-- Backfill: the one GoogleIntegration row that exists today (if connected
-- already) belongs to the one Tenant that exists today.
UPDATE "GoogleIntegration" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;

-- Now safe to enforce NOT NULL.
ALTER TABLE "GoogleIntegration" ALTER COLUMN "tenantId" SET NOT NULL;

-- Swap the primary key from "id" to "tenantId".
ALTER TABLE "GoogleIntegration" DROP CONSTRAINT "GoogleIntegration_pkey";
ALTER TABLE "GoogleIntegration" DROP COLUMN "id";
ALTER TABLE "GoogleIntegration" ADD CONSTRAINT "GoogleIntegration_pkey" PRIMARY KEY ("tenantId");

-- AddForeignKey
ALTER TABLE "GoogleIntegration" ADD CONSTRAINT "GoogleIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
