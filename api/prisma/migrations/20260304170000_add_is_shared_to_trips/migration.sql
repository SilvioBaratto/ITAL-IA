-- AlterTable
ALTER TABLE "trips" ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;

-- RLS: Allow all authenticated users to SELECT shared trips and their child data
CREATE POLICY "Authenticated users can view shared trips"
  ON trips FOR SELECT TO authenticated
  USING (is_shared = true);

CREATE POLICY "Authenticated users can view shared trip days"
  ON trip_days FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE is_shared = true));

CREATE POLICY "Authenticated users can view shared activities"
  ON activities FOR SELECT TO authenticated
  USING (trip_day_id IN (
    SELECT td.id FROM trip_days td
    JOIN trips t ON t.id = td.trip_id
    WHERE t.is_shared = true
  ));

CREATE POLICY "Authenticated users can view shared highlights"
  ON activity_highlights FOR SELECT TO authenticated
  USING (activity_id IN (
    SELECT a.id FROM activities a
    JOIN trip_days td ON td.id = a.trip_day_id
    JOIN trips t ON t.id = td.trip_id
    WHERE t.is_shared = true
  ));

CREATE POLICY "Authenticated users can view shared bookings"
  ON bookings FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE is_shared = true));

CREATE POLICY "Authenticated users can view shared tips"
  ON travel_tips FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE is_shared = true));
