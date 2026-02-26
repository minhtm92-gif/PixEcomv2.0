-- AlterTable: Add faviconUrl to sellers
ALTER TABLE "sellers" ADD COLUMN "favicon_url" VARCHAR(500);

-- AlterTable: Add allowOutOfStockPurchase to products
ALTER TABLE "products" ADD COLUMN "allow_out_of_stock_purchase" BOOLEAN NOT NULL DEFAULT false;
