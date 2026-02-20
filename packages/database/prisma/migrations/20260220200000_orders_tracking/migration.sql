-- Migration: 20260220200000_orders_tracking
-- Milestone 2.3.6 — Orders Upgrade (Tracking + Transaction ID)
--
-- Changes:
--   1. Add tracking_status + tracking_provider columns to orders
--   2. Add auto_tracking_refresh column to seller_settings
--   3. Partial index on orders for efficient auto-refresh queries

-- ── Orders: tracking status + provider ────────────────────────────────────────
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "tracking_status"   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "tracking_provider" VARCHAR(50);

-- Partial index: only rows that have a tracking number and need status checks
CREATE INDEX IF NOT EXISTS "orders_seller_tracking_idx"
  ON "orders" ("seller_id", "tracking_status")
  WHERE "tracking_number" IS NOT NULL;

-- ── SellerSettings: auto-tracking refresh flag ────────────────────────────────
ALTER TABLE "seller_settings"
  ADD COLUMN IF NOT EXISTS "auto_tracking_refresh" BOOLEAN NOT NULL DEFAULT false;

-- ── order_event_type enum: add TRACKING_REFRESHED ─────────────────────────────
ALTER TYPE "order_event_type" ADD VALUE IF NOT EXISTS 'TRACKING_REFRESHED';
