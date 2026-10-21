-- AlterTable
ALTER TABLE "EventType" ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "price" DROP DEFAULT;

-- DataMigration: under the old semantics, 0 *was* "not priced" (just always
-- rendered as the word "Díjmentes" rather than genuinely hidden, which is
-- exactly what this migration fixes) -- re-express every existing 0 as the
-- new "not priced" value, NULL, so nothing changes for a coach who already
-- had this set to the default. A service some coach genuinely priced at a
-- real number is untouched.
UPDATE "EventType" SET "price" = NULL WHERE "price" = 0;
