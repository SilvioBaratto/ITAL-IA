-- DropTable (if previously created with SERIAL id)
DROP TABLE IF EXISTS "comuni";

-- CreateTable
CREATE TABLE "comuni" (
    "id"        UUID          NOT NULL DEFAULT gen_random_uuid(),
    "name"      VARCHAR(200)  NOT NULL,
    "province"  VARCHAR(5)    NOT NULL,
    "region_id" VARCHAR(50)   NOT NULL,
    "latitude"  DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,

    CONSTRAINT "comuni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comuni_name_region_id_key" ON "comuni"("name", "region_id");

-- CreateIndex
CREATE INDEX "comuni_region_id_idx" ON "comuni"("region_id");

-- CreateIndex
CREATE INDEX "comuni_province_region_id_idx" ON "comuni"("province", "region_id");

-- AddForeignKey
ALTER TABLE "comuni"
    ADD CONSTRAINT "comuni_region_id_fkey"
    FOREIGN KEY ("region_id") REFERENCES "regions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
