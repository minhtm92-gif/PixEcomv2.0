-- Migration: 20260219100000_hardening_2311
-- Milestone 2.3.1.1 — Pre-2.3.2 Hardening
--
-- Adds composite indexes on (seller_id, is_active) for both fb_connections
-- and ad_strategies tables, supporting efficient active-only list queries.

-- Index: fb_connections (seller_id, is_active)
-- Speeds up: GET /api/fb/connections (default active-only filter)
CREATE INDEX IF NOT EXISTS "fb_connections_seller_id_is_active_idx"
  ON "fb_connections" ("seller_id", "is_active");

-- Index: ad_strategies (seller_id, is_active)
-- Speeds up: GET /api/fb/ad-strategies (default active-only filter)
CREATE INDEX IF NOT EXISTS "ad_strategies_seller_id_is_active_idx"
  ON "ad_strategies" ("seller_id", "is_active");
