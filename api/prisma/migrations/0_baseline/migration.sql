Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "region_group" AS ENUM ('NORD', 'CENTRO', 'SUD', 'ISOLE');

-- CreateEnum
CREATE TYPE "poi_category" AS ENUM ('RESTAURANT', 'MUSEUM', 'PARK', 'MARKET', 'BAR', 'LANDMARK', 'VENUE', 'CHURCH', 'ROOFTOP', 'NEIGHBORHOOD', 'EVENT_VENUE', 'WINERY', 'EXPERIENCE_SITE');

-- CreateEnum
CREATE TYPE "chat_message_role" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "saved_item_category" AS ENUM ('RESTAURANT', 'MUSEUM', 'EVENT', 'PLACE', 'WINE', 'EXPERIENCE');

-- CreateTable
CREATE TABLE "regions" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "group" "region_group" NOT NULL,
    "has_kb" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_of_interest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(500) NOT NULL,
    "region_id" VARCHAR(50) NOT NULL,
    "category" "poi_category" NOT NULL,
    "address" VARCHAR(500),
    "neighborhood" VARCHAR(255),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "website_url" VARCHAR(1000),
    "maps_url" VARCHAR(1000),
    "image_url" VARCHAR(1000),
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "points_of_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "region_id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL DEFAULT 'Nuova conversazione',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" "chat_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "rich_content" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "region_id" VARCHAR(50) NOT NULL,
    "category" "saved_item_category" NOT NULL,
    "poi_id" UUID,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "address" VARCHAR(500),
    "maps_url" VARCHAR(1000),
    "website" VARCHAR(1000),
    "image_url" VARCHAR(1000),
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE INDEX "points_of_interest_region_id_idx" ON "points_of_interest"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_of_interest_name_region_id_category_key" ON "points_of_interest"("name", "region_id", "category");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_region_id_idx" ON "chat_conversations"("user_id", "region_id");

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_updated_at_idx" ON "chat_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_items_user_id_region_id_idx" ON "saved_items"("user_id", "region_id");

-- CreateIndex
CREATE INDEX "saved_items_user_id_category_idx" ON "saved_items"("user_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "saved_items_user_id_name_region_id_category_key" ON "saved_items"("user_id", "name", "region_id", "category");

-- AddForeignKey
ALTER TABLE "points_of_interest" ADD CONSTRAINT "points_of_interest_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_poi_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "points_of_interest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

