-- Migration: 20260220100000_store_entity_stats
-- Adds:
--   1. UTM attribution fields on orders
--   2. store_entity_stats_daily table (store-side metrics per entity per day)

-- ── 1. UTM fields on orders ────────────────────────────────────────────────
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "utm_source"   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "utm_medium"   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_term"     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_content"  VARCHAR(255);

-- Index for campaign attribution (utm_campaign = 'c_<campaignId>')
CREATE INDEX IF NOT EXISTS "orders_seller_utm_campaign_idx"
  ON "orders" ("seller_id", "utm_campaign");

-- Index for adset attribution (utm_term = 'as_<adsetId>')
CREATE INDEX IF NOT EXISTS "orders_seller_utm_term_idx"
  ON "orders" ("seller_id", "utm_term");

-- Index for ad attribution (utm_content = 'a_<adId>')
CREATE INDEX IF NOT EXISTS "orders_seller_utm_content_idx"
  ON "orders" ("seller_id", "utm_content");

-- ── 2. store_entity_stats_daily ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "store_entity_stats_daily" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "seller_id"     UUID         NOT NULL,
  "platform"      VARCHAR(20)  NOT NULL DEFAULT 'META',
  "level"         VARCHAR(10)  NOT NULL,   -- 'CAMPAIGN' | 'ADSET' | 'AD'
  "entity_id"     UUID         NOT NULL,
  "stat_date"     DATE         NOT NULL,
  "content_views" INTEGER      NOT NULL DEFAULT 0,
  "checkouts"     INTEGER      NOT NULL DEFAULT 0,
  "purchases"     INTEGER      NOT NULL DEFAULT 0,
  "revenue"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "store_entity_stats_daily_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_store_entity_stats_daily"
    UNIQUE ("seller_id", "level", "entity_id", "stat_date")
);

CREATE INDEX IF NOT EXISTS "store_entity_stats_seller_entity_date_idx"
  ON "store_entity_stats_daily" ("seller_id", "level", "entity_id", "stat_date");

ALTER TABLE "store_entity_stats_daily"
  ADD CONSTRAINT "store_entity_stats_daily_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "sellers" ("id") ON DELETE CASCADE;
