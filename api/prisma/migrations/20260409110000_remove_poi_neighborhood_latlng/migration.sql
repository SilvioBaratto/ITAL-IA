-- Remove neighborhood, latitude, and longitude columns from points_of_interest.
-- Rationale: the deep-research KB doesn't provide per-venue coordinates and
-- rarely names a quartiere/rione. The fields were nullable placeholders that
-- the extraction pipeline left empty, so we're dropping them to simplify the
-- schema and stop carrying dead columns through every query.

ALTER TABLE "points_of_interest" DROP COLUMN "neighborhood";
ALTER TABLE "points_of_interest" DROP COLUMN "latitude";
ALTER TABLE "points_of_interest" DROP COLUMN "longitude";
