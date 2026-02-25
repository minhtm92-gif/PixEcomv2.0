-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_owner_seller_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_creatives" DROP CONSTRAINT "campaign_creatives_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "campaign_creatives" DROP CONSTRAINT "campaign_creatives_creative_id_fkey";

-- DropForeignKey
ALTER TABLE "creative_assets" DROP CONSTRAINT "creative_assets_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "creative_assets" DROP CONSTRAINT "creative_assets_creative_id_fkey";

-- DropForeignKey
ALTER TABLE "creatives" DROP CONSTRAINT "creatives_product_id_fkey";

-- DropForeignKey
ALTER TABLE "creatives" DROP CONSTRAINT "creatives_seller_id_fkey";

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "campaign_creatives" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "creative_assets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "creatives" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "images" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_seller_id_source_idx" ON "orders"("seller_id", "source");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_seller_id_fkey" FOREIGN KEY ("owner_seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_creatives" ADD CONSTRAINT "campaign_creatives_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "campaign_creatives_uq_campaign_creative" RENAME TO "campaign_creatives_campaign_id_creative_id_key";

-- RenameIndex
ALTER INDEX "uq_review_order_product" RENAME TO "reviews_order_id_product_id_key";
