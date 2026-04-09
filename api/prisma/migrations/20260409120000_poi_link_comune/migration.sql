-- Normalize points_of_interest: link to comuni instead of regions directly.
-- Safe destructive migration: the table is empty (verified via MCP, 0 rows).
-- After this, POI → Comune → Region is the only region linkage path, so every
-- POI physically belongs to a specific municipality and can be filtered by
-- (region, comune, category) with a single join.

-- Prisma created the composite uniqueness as a unique INDEX rather than a
-- named CONSTRAINT, so we drop it via DROP INDEX. DROP INDEX IF EXISTS keeps
-- the migration idempotent if it gets partially applied.
DROP INDEX IF EXISTS "points_of_interest_name_region_id_category_key";
DROP INDEX IF EXISTS "points_of_interest_region_id_idx";
DROP INDEX IF EXISTS "points_of_interest_category_region_id_idx";

-- The FK on region_id is a real constraint.
ALTER TABLE "points_of_interest" DROP CONSTRAINT IF EXISTS "points_of_interest_region_id_fkey";

-- Drop the old column and add the new one. Safe because the table is empty;
-- if there were any rows the NOT NULL would fail and we'd need a staged
-- migration with a backfill step.
ALTER TABLE "points_of_interest" DROP COLUMN "region_id";
ALTER TABLE "points_of_interest" ADD COLUMN "comune_id" UUID NOT NULL;

-- New FK, unique constraint, and indexes
ALTER TABLE "points_of_interest"
  ADD CONSTRAINT "points_of_interest_comune_id_fkey"
  FOREIGN KEY ("comune_id") REFERENCES "comuni"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "points_of_interest_name_comune_id_category_key"
  ON "points_of_interest"("name", "comune_id", "category");

CREATE INDEX "points_of_interest_comune_id_idx"
  ON "points_of_interest"("comune_id");

CREATE INDEX "points_of_interest_category_comune_id_idx"
  ON "points_of_interest"("category", "comune_id");
