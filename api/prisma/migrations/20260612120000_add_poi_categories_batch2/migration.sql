-- Rationale: the deep-research KB expanded from 13 to 20 POI categories.
-- schema.prisma already lists all 20 in enum PoiCategory, but the live DB
-- enum poi_category still has only the original 13. Add the 7 new values so
-- populate-pois.ts can upsert AGRITURISMO/SAGRA/etc. without
-- "invalid input value for enum poi_category". IF NOT EXISTS makes it idempotent.

ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'SAGRA';
ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'BEACH';
ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'AGRITURISMO';
ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'FESTIVAL';
ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'DANCE';
ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'STREET_FOOD';
ALTER TYPE "poi_category" ADD VALUE IF NOT EXISTS 'PUB';
