-- CreateTable
CREATE TABLE "spend_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "cumulative_spend" DECIMAL(15,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stat_date" DATE NOT NULL,

    CONSTRAINT "spend_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spend_snapshots_seller_id_stat_date_recorded_at_idx" ON "spend_snapshots"("seller_id", "stat_date", "recorded_at");

-- AddForeignKey
ALTER TABLE "spend_snapshots" ADD CONSTRAINT "spend_snapshots_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
