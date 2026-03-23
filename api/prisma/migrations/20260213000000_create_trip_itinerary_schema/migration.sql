Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('MEAL', 'VISIT', 'TRANSPORT', 'WALK', 'NIGHTLIFE', 'SHOW', 'SHOPPING', 'REST');

-- CreateEnum
CREATE TYPE "place_type" AS ENUM ('RESTAURANT', 'MUSEUM', 'PARK', 'MARKET', 'BAR', 'LANDMARK', 'VENUE', 'CHURCH', 'ROOFTOP', 'NEIGHBORHOOD');

-- CreateEnum
CREATE TYPE "tip_category" AS ENUM ('TRANSPORT', 'SAFETY', 'BUDGET', 'PACKING');

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL DEFAULT auth.uid(),
    "title" VARCHAR(500) NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "theme" VARCHAR(500),

    CONSTRAINT "trip_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_day_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "start_time" VARCHAR(10),
    "end_time" VARCHAR(10),
    "duration_minutes" INTEGER,
    "activity_type" "activity_type" NOT NULL,
    "price_min_cents" INTEGER,
    "price_max_cents" INTEGER,
    "price_currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "price_note" VARCHAR(500),
    "place_id" UUID,
    "alternative_to_id" UUID,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(500) NOT NULL,
    "address" VARCHAR(500),
    "neighborhood" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "place_type" "place_type" NOT NULL,
    "website_url" VARCHAR(500),

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_highlights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "activity_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "place_id" UUID,
    "attraction_name" VARCHAR(500) NOT NULL,
    "price_cents" INTEGER,
    "price_currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "discount_note" VARCHAR(500),
    "booking_url" VARCHAR(500),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_tips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "category" "tip_category" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "travel_tips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_days_trip_id_day_number_key" ON "trip_days"("trip_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "activities_trip_day_id_sort_order_key" ON "activities"("trip_day_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "activity_highlights_activity_id_sort_order_key" ON "activity_highlights"("activity_id", "sort_order");

-- AddForeignKey
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_trip_day_id_fkey" FOREIGN KEY ("trip_day_id") REFERENCES "trip_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_alternative_to_id_fkey" FOREIGN KEY ("alternative_to_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_highlights" ADD CONSTRAINT "activity_highlights_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_tips" ADD CONSTRAINT "travel_tips_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

