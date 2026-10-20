-- Introduces Tenant as the multi-tenant foundation above Coach. Hand-edited
-- (not the raw `prisma migrate dev` output) because adding a required,
-- non-defaulted Coach.tenantId column needs a backfill step first: create
-- the table, insert one default Tenant for all of today's (single-business)
-- data, backfill every existing Coach onto it, THEN make the column
-- required and add the FK/index.

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- One Tenant row representing the one real business that exists so far.
-- `updatedAt` has no column default (matches every other @updatedAt field
-- in this schema), so it must be supplied explicitly here.
INSERT INTO "Tenant" ("id", "name", "updatedAt")
VALUES ('default-tenant', 'Betti Coaching', CURRENT_TIMESTAMP);

-- AlterTable (nullable first, so the backfill below can run)
ALTER TABLE "Coach" ADD COLUMN "tenantId" TEXT;

-- Backfill: every Coach that exists today belongs to the one business above.
UPDATE "Coach" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;

-- Now safe to enforce NOT NULL.
ALTER TABLE "Coach" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Coach_tenantId_idx" ON "Coach"("tenantId");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
