-- Product: add images, optionDefinitions, quantityCosts
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "option_definitions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "quantity_costs" JSONB NOT NULL DEFAULT '[]';

-- ProductVariant: add costPrice, fulfillmentCost, image
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(10,2);
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "fulfillment_cost" DECIMAL(10,2);
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "image" VARCHAR(500);
