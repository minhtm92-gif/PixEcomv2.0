-- Milestone 2.3.4-D: Orders Read Layer
-- Add index (seller_id, created_at) on orders for date-range list queries.
-- IF NOT EXISTS: already present from 2.3.4-C migration on parallel branch.

CREATE INDEX IF NOT EXISTS "orders_seller_id_created_at_idx"
  ON "orders" ("seller_id", "created_at");
