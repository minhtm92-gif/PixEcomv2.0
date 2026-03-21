-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: Add rating + review_count to products
ALTER TABLE "products" ADD COLUMN "rating" DECIMAL(2,1) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: reviews
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID,
    "author_name" VARCHAR(255) NOT NULL,
    "author_email" VARCHAR(255) NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "images" JSONB NOT NULL DEFAULT '[]',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_product_id_status_idx" ON "reviews"("product_id", "status");
CREATE INDEX "reviews_seller_id_created_at_idx" ON "reviews"("seller_id", "created_at");

-- Unique constraint: one review per order+product
CREATE UNIQUE INDEX "uq_review_order_product" ON "reviews"("order_id", "product_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
