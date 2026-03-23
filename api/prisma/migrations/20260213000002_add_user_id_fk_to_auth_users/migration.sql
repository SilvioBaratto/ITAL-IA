-- AddForeignKey
ALTER TABLE trips
  ADD CONSTRAINT trips_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
