-- AlterTable: Add missing database indexes for performance

-- 1. Order: upgrade (seller_id, created_at) to DESC sort on created_at
DROP INDEX IF EXISTS "orders_seller_id_created_at_idx";
CREATE INDEX "orders_seller_id_created_at_idx" ON "orders"("seller_id", "created_at" DESC);

-- 2. Discount: FK index on sellpage_id
CREATE INDEX "discounts_sellpage_id_idx" ON "discounts"("sellpage_id");

-- 3. Product: catalog listing index (status + created_at DESC)
CREATE INDEX "products_status_created_at_idx" ON "products"("status", "created_at" DESC);

-- 4. Campaign: FK index on ad_account_id
CREATE INDEX "campaigns_ad_account_id_idx" ON "campaigns"("ad_account_id");

-- 5. Sellpage: domain lookup index on domain_id
CREATE INDEX "sellpages_domain_id_idx" ON "sellpages"("domain_id");

-- 6. Review: moderation queue index (seller_id + status + created_at DESC)
CREATE INDEX "reviews_seller_id_status_created_at_idx" ON "reviews"("seller_id", "status", "created_at" DESC);

-- 7. User: login validation index (email + is_active)
CREATE INDEX "users_email_is_active_idx" ON "users"("email", "is_active");
