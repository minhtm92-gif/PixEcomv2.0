-- Milestone 2.3.4-C: Analytics Overview
-- Add index (seller_id, created_at) on orders for date-range revenue aggregation.
-- Existing indexes: (seller_id, status), (seller_id, sellpage_id) — no date index.

CREATE INDEX IF NOT EXISTS "orders_seller_id_created_at_idx"
  ON "orders" ("seller_id", "created_at");
