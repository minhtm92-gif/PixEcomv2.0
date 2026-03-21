-- CreateEnum
CREATE TYPE "seller_status" AS ENUM ('ACTIVE', 'PENDING', 'DEACTIVATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPERADMIN', 'SUPPORT', 'FINANCE', 'CONTENT', 'SELLER');

-- AlterTable: Add role to users
ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'SELLER';

-- AlterTable: Add status and payment_gateway_id to sellers
ALTER TABLE "sellers" ADD COLUMN "status" "seller_status" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "sellers" ADD COLUMN "payment_gateway_id" UUID;

-- CreateTable: payment_gateways
CREATE TABLE "payment_gateways" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "environment" VARCHAR(20) NOT NULL DEFAULT 'sandbox',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable: discounts
CREATE TABLE "discounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "usage_limit" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "sellpage_id" UUID,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_settings
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "platform_name" VARCHAR(255) NOT NULL DEFAULT 'PixEcom',
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "default_timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "default_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "support_email" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "smtp_config" JSONB NOT NULL DEFAULT '{}',
    "sms_config" JSONB NOT NULL DEFAULT '{}',
    "legal_pages" JSONB NOT NULL DEFAULT '{}',
    "billing_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique discount code
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- AddForeignKey: sellers -> payment_gateways
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_payment_gateway_id_fkey" FOREIGN KEY ("payment_gateway_id") REFERENCES "payment_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: discounts -> sellpages
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_sellpage_id_fkey" FOREIGN KEY ("sellpage_id") REFERENCES "sellpages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Set seller status based on existing is_active
UPDATE "sellers" SET "status" = 'ACTIVE' WHERE "is_active" = true;
UPDATE "sellers" SET "status" = 'DEACTIVATED' WHERE "is_active" = false;

-- Backfill: Set user role based on existing is_superadmin
UPDATE "users" SET "role" = 'SUPERADMIN' WHERE "is_superadmin" = true;
UPDATE "users" SET "role" = 'SELLER' WHERE "is_superadmin" = false;
