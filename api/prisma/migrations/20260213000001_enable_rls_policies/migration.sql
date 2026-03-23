-- Enable RLS on all tables
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_tips ENABLE ROW LEVEL SECURITY;

-- TRIPS: owner has full access
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own trips"
  ON trips FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- TRIP_DAYS: access via trip ownership
CREATE POLICY "Users can view own trip days"
  ON trip_days FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own trip days"
  ON trip_days FOR INSERT TO authenticated
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own trip days"
  ON trip_days FOR UPDATE TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own trip days"
  ON trip_days FOR DELETE TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

-- ACTIVITIES: access via trip_day -> trip
CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT TO authenticated
  USING (trip_day_id IN (
    SELECT td.id FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own activities"
  ON activities FOR INSERT TO authenticated
  WITH CHECK (trip_day_id IN (
    SELECT td.id FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE TO authenticated
  USING (trip_day_id IN (
    SELECT td.id FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ))
  WITH CHECK (trip_day_id IN (
    SELECT td.id FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE TO authenticated
  USING (trip_day_id IN (
    SELECT td.id FROM trip_days td JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

-- ACTIVITY_HIGHLIGHTS: access via activity -> trip_day -> trip
CREATE POLICY "Users can view own highlights"
  ON activity_highlights FOR SELECT TO authenticated
  USING (activity_id IN (
    SELECT a.id FROM activities a JOIN trip_days td ON td.id = a.trip_day_id JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own highlights"
  ON activity_highlights FOR INSERT TO authenticated
  WITH CHECK (activity_id IN (
    SELECT a.id FROM activities a JOIN trip_days td ON td.id = a.trip_day_id JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own highlights"
  ON activity_highlights FOR UPDATE TO authenticated
  USING (activity_id IN (
    SELECT a.id FROM activities a JOIN trip_days td ON td.id = a.trip_day_id JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ))
  WITH CHECK (activity_id IN (
    SELECT a.id FROM activities a JOIN trip_days td ON td.id = a.trip_day_id JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own highlights"
  ON activity_highlights FOR DELETE TO authenticated
  USING (activity_id IN (
    SELECT a.id FROM activities a JOIN trip_days td ON td.id = a.trip_day_id JOIN trips t ON t.id = td.trip_id WHERE t.user_id = auth.uid()
  ));

-- BOOKINGS: access via trip ownership
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT TO authenticated
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own bookings"
  ON bookings FOR DELETE TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

-- TRAVEL_TIPS: access via trip ownership
CREATE POLICY "Users can view own tips"
  ON travel_tips FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own tips"
  ON travel_tips FOR INSERT TO authenticated
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own tips"
  ON travel_tips FOR UPDATE TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own tips"
  ON travel_tips FOR DELETE TO authenticated
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));

-- PLACES: shared reference data, all authenticated can read/write
CREATE POLICY "Authenticated users can view all places"
  ON places FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create places"
  ON places FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update places"
  ON places FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete places"
  ON places FOR DELETE TO authenticated
  USING (true);
