-- Task B3: Order Source Attribution + UTM Fields
-- Adds source channel, transactionId, and 5 UTM parameters to orders table.
-- All columns are nullable for full backward compatibility.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "source"       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "transaction_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_source"   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_medium"   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_term"     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "utm_content"  VARCHAR(255);

-- Index for filtering orders by seller + source (e.g. ?source=facebook)
CREATE INDEX IF NOT EXISTS "orders_seller_id_source_idx"
  ON "orders" ("seller_id", "source")
  WHERE "source" IS NOT NULL;
