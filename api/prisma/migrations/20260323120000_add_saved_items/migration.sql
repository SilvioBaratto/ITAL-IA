-- CreateEnum
CREATE TYPE "saved_item_category" AS ENUM ('RESTAURANT', 'MUSEUM', 'EVENT', 'PLACE', 'WINE', 'EXPERIENCE');

-- CreateTable
CREATE TABLE "saved_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "category" "saved_item_category" NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "address" VARCHAR(500),
    "maps_url" VARCHAR(1000),
    "website" VARCHAR(1000),
    "image_url" VARCHAR(1000),
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_user_id_name_region_category_key" ON "saved_items"("user_id", "name", "region", "category");

-- CreateIndex
CREATE INDEX "saved_items_user_id_region_idx" ON "saved_items"("user_id", "region");

-- CreateIndex
CREATE INDEX "saved_items_user_id_category_idx" ON "saved_items"("user_id", "category");
