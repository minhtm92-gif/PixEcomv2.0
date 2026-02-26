-- Split single paymentGatewayId into paypalGatewayId + creditCardGatewayId

-- Step 1: Add new columns
ALTER TABLE "sellers" ADD COLUMN "paypal_gateway_id" UUID;
ALTER TABLE "sellers" ADD COLUMN "credit_card_gateway_id" UUID;

-- Step 2: Migrate existing data based on gateway type
-- PayPal types → paypal_gateway_id
UPDATE "sellers" s
SET "paypal_gateway_id" = s."payment_gateway_id"
FROM "payment_gateways" pg
WHERE s."payment_gateway_id" = pg."id"
  AND pg."type" IN ('paypal', 'paypal_pro');

-- Credit card types (stripe, airwallex, tazapay, etc.) → credit_card_gateway_id
UPDATE "sellers" s
SET "credit_card_gateway_id" = s."payment_gateway_id"
FROM "payment_gateways" pg
WHERE s."payment_gateway_id" = pg."id"
  AND pg."type" NOT IN ('paypal', 'paypal_pro');

-- Step 3: Drop old FK constraint and column
ALTER TABLE "sellers" DROP CONSTRAINT IF EXISTS "sellers_payment_gateway_id_fkey";
ALTER TABLE "sellers" DROP COLUMN "payment_gateway_id";

-- Step 4: Add new FK constraints
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_paypal_gateway_id_fkey"
  FOREIGN KEY ("paypal_gateway_id") REFERENCES "payment_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sellers" ADD CONSTRAINT "sellers_credit_card_gateway_id_fkey"
  FOREIGN KEY ("credit_card_gateway_id") REFERENCES "payment_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
