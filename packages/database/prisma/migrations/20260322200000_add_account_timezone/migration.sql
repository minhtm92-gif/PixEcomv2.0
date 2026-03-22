-- AlterTable
ALTER TABLE "ad_stats_daily" ADD COLUMN "account_timezone" VARCHAR(64);

-- Backfill existing rows from the ad account's metadata.timezone
-- Each ad_stats_daily row has a seller_id + entity_id; the entity is a campaign/adset/ad
-- which links to an ad account via campaign.ad_account_id → fb_connections.id → metadata->>'timezone'
-- For simplicity, backfill using the seller's first active AD_ACCOUNT timezone.
UPDATE "ad_stats_daily" asd
SET "account_timezone" = sub.tz
FROM (
  SELECT DISTINCT ON (fc."seller_id")
    fc."seller_id",
    fc."metadata"->>'timezone' AS tz
  FROM "fb_connections" fc
  WHERE fc."connection_type" = 'AD_ACCOUNT'
    AND fc."is_active" = true
    AND fc."metadata"->>'timezone' IS NOT NULL
  ORDER BY fc."seller_id", fc."created_at" ASC
) sub
WHERE asd."seller_id" = sub."seller_id"
  AND asd."account_timezone" IS NULL;
