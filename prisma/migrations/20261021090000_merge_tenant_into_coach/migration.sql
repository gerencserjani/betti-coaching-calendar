-- Merges Tenant back into Coach: one Coach IS one business now, always
-- (see CONTEXT.md "Standing decision: one Tenant = one Coach, always" --
-- multi-coach-per-tenant was explicitly ruled out). Hand-written, not raw
-- `prisma migrate dev` output: this repoints Settings/GoogleIntegration
-- from Tenant to Coach using the existing 1:1 Tenant<->Coach mapping,
-- before dropping Tenant and Coach.tenantId entirely. Also drops the
-- now-unused OWNER value from CoachRole (Postgres has no ALTER TYPE ...
-- DROP VALUE, so the enum type is recreated).

-- Drop the FKs pointing at Tenant so the id columns below can be
-- repointed to Coach ids without violating them mid-update.
ALTER TABLE "Settings" DROP CONSTRAINT "Settings_tenantId_fkey";
ALTER TABLE "GoogleIntegration" DROP CONSTRAINT "GoogleIntegration_tenantId_fkey";

-- Repoint Settings/GoogleIntegration from the Tenant id they stored to the
-- id of the one Coach that belonged to that Tenant (always exactly one,
-- per the 1:1 invariant this migration is making permanent).
UPDATE "Settings" s SET "tenantId" = c.id
  FROM "Coach" c WHERE c."tenantId" = s."tenantId";
UPDATE "GoogleIntegration" g SET "tenantId" = c.id
  FROM "Coach" c WHERE c."tenantId" = g."tenantId";

ALTER TABLE "Settings" RENAME COLUMN "tenantId" TO "coachId";
ALTER TABLE "GoogleIntegration" RENAME COLUMN "tenantId" TO "coachId";

ALTER TABLE "Settings" ADD CONSTRAINT "Settings_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleIntegration" ADD CONSTRAINT "GoogleIntegration_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop Coach.tenantId and the Tenant table it pointed at.
ALTER TABLE "Coach" DROP CONSTRAINT "Coach_tenantId_fkey";
DROP INDEX "Coach_tenantId_idx";
ALTER TABLE "Coach" DROP COLUMN "tenantId";
DROP TABLE "Tenant";

-- Drop the now-unused OWNER value from CoachRole. No real row anywhere
-- (local, test, or production -- production never had this migration
-- series applied yet) has ever had role = 'OWNER', so this is a type swap,
-- not a data migration.
ALTER TYPE "CoachRole" RENAME TO "CoachRole_old";
CREATE TYPE "CoachRole" AS ENUM ('ADMIN', 'COACH');
ALTER TABLE "Coach" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Coach" ALTER COLUMN "role" TYPE "CoachRole" USING ("role"::text::"CoachRole");
ALTER TABLE "Coach" ALTER COLUMN "role" SET DEFAULT 'COACH';
DROP TYPE "CoachRole_old";
