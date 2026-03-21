-- Add billing_address JSONB column to orders
-- Stores billing address when different from shipping address
ALTER TABLE "orders" ADD COLUMN "billing_address" JSONB;
