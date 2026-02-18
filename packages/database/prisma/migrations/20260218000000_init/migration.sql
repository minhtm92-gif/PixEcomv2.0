-- CreateEnum
CREATE TYPE "seller_user_role" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "domain_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "verification_method" AS ENUM ('TXT', 'A_RECORD');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "sellpage_type" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "sellpage_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "fb_connection_type" AS ENUM ('AD_ACCOUNT', 'PAGE', 'PIXEL', 'CONVERSION');

-- CreateEnum
CREATE TYPE "budget_type" AS ENUM ('DAILY', 'LIFETIME');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "post_source" AS ENUM ('EXISTING', 'CONTENT_SOURCE');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "order_event_type" AS ENUM ('CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'NOTE_ADDED');

-- CreateEnum
CREATE TYPE "stats_entity_type" AS ENUM ('CAMPAIGN', 'ADSET', 'AD');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "display_name" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_superadmin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "logo_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_users" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "seller_user_role" NOT NULL DEFAULT 'EDITOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_settings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "brand_name" VARCHAR(255),
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "support_email" VARCHAR(255),
    "meta_pixel_id" VARCHAR(100),
    "google_analytics_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_domains" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "hostname" VARCHAR(255) NOT NULL,
    "verification_method" "verification_method" NOT NULL DEFAULT 'TXT',
    "verification_token" VARCHAR(100) NOT NULL,
    "status" "domain_status" NOT NULL DEFAULT 'PENDING',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "product_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "compare_at_price" DECIMAL(10,2),
    "cost_price" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "sku" VARCHAR(100),
    "description" TEXT,
    "description_blocks" JSONB NOT NULL DEFAULT '[]',
    "shipping_info" JSONB NOT NULL DEFAULT '{}',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(100),
    "price_override" DECIMAL(10,2),
    "compare_at_price" DECIMAL(10,2),
    "options" JSONB NOT NULL DEFAULT '{}',
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_labels" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_product_labels" (
    "product_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,

    CONSTRAINT "product_product_labels_pkey" PRIMARY KEY ("product_id","label_id")
);

-- CreateTable
CREATE TABLE "asset_media" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "media_type" "media_type" NOT NULL,
    "duration_sec" INTEGER,
    "file_size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_thumbnails" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_adtexts" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "primary_text" TEXT NOT NULL,
    "headline" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_adtexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL,
    "product_id" UUID,
    "suggested_retail" DECIMAL(10,2) NOT NULL,
    "seller_take_percent" DECIMAL(5,2) NOT NULL,
    "seller_take_fixed" DECIMAL(10,2),
    "hold_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hold_duration_days" INTEGER NOT NULL DEFAULT 7,
    "effective_from" TIMESTAMPTZ NOT NULL,
    "effective_until" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellpages" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "domain_id" UUID,
    "slug" VARCHAR(100) NOT NULL,
    "custom_domain" VARCHAR(255),
    "sellpage_type" "sellpage_type" NOT NULL DEFAULT 'SINGLE',
    "status" "sellpage_status" NOT NULL DEFAULT 'DRAFT',
    "title_override" VARCHAR(255),
    "description_override" TEXT,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "seo_og_image" VARCHAR(500),
    "sections" JSONB NOT NULL DEFAULT '[]',
    "header_config" JSONB NOT NULL DEFAULT '{}',
    "footer_config" JSONB NOT NULL DEFAULT '{}',
    "boost_modules" JSONB NOT NULL DEFAULT '[]',
    "discount_rules" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellpages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_connections" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "connection_type" "fb_connection_type" NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "access_token_enc" TEXT,
    "parent_id" UUID,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_strategies" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "sellpage_id" UUID NOT NULL,
    "ad_account_id" UUID NOT NULL,
    "ad_strategy_id" UUID,
    "external_campaign_id" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "budget" DECIMAL(10,2) NOT NULL,
    "budget_type" "budget_type" NOT NULL DEFAULT 'DAILY',
    "status" "campaign_status" NOT NULL DEFAULT 'ACTIVE',
    "delivery_status" VARCHAR(50),
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adsets" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "external_adset_id" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "status" "campaign_status" NOT NULL DEFAULT 'ACTIVE',
    "delivery_status" VARCHAR(50),
    "optimization_goal" VARCHAR(100),
    "targeting" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" UUID NOT NULL,
    "adset_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "external_ad_id" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "status" "campaign_status" NOT NULL DEFAULT 'ACTIVE',
    "delivery_status" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_posts" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "ad_id" UUID,
    "page_id" UUID NOT NULL,
    "external_post_id" VARCHAR(255),
    "post_source" "post_source" NOT NULL,
    "asset_media_id" UUID,
    "asset_thumbnail_id" UUID,
    "asset_adtext_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "sellpage_id" UUID,
    "order_number" VARCHAR(50) NOT NULL,
    "customer_email" VARCHAR(255) NOT NULL,
    "customer_name" VARCHAR(255),
    "customer_phone" VARCHAR(50),
    "shipping_address" JSONB NOT NULL DEFAULT '{}',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "payment_method" VARCHAR(50),
    "payment_id" VARCHAR(255),
    "paid_at" TIMESTAMPTZ,
    "tracking_number" VARCHAR(255),
    "tracking_url" VARCHAR(1000),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "product_name" VARCHAR(255) NOT NULL,
    "variant_name" VARCHAR(255),
    "sku" VARCHAR(100),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "event_type" "order_event_type" NOT NULL,
    "description" VARCHAR(500),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_stats_raw" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "entity_type" "stats_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "external_entity_id" VARCHAR(255) NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL,
    "date_start" DATE NOT NULL,
    "date_stop" DATE NOT NULL,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "cpm" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "link_clicks" INTEGER NOT NULL DEFAULT 0,
    "content_views" INTEGER NOT NULL DEFAULT 0,
    "add_to_cart" INTEGER NOT NULL DEFAULT 0,
    "checkout_initiated" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "purchase_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cost_per_purchase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "roas" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_stats_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_stats_daily" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "entity_type" "stats_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "cpm" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "link_clicks" INTEGER NOT NULL DEFAULT 0,
    "content_views" INTEGER NOT NULL DEFAULT 0,
    "add_to_cart" INTEGER NOT NULL DEFAULT 0,
    "checkout_initiated" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "purchase_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cost_per_purchase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "roas" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellpage_stats_daily" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "sellpage_id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "ad_source" VARCHAR(50) NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "ad_spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "roas" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "cpm" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "link_clicks" INTEGER NOT NULL DEFAULT 0,
    "content_views" INTEGER NOT NULL DEFAULT 0,
    "add_to_cart" INTEGER NOT NULL DEFAULT 0,
    "checkout_initiated" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "cost_per_purchase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cr1" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "cr2" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "cr3" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellpage_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_slug_key" ON "sellers"("slug");

-- CreateIndex
CREATE INDEX "seller_users_seller_id_idx" ON "seller_users"("seller_id");

-- CreateIndex
CREATE INDEX "seller_users_user_id_idx" ON "seller_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_users_seller_id_user_id_key" ON "seller_users"("seller_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_settings_seller_id_key" ON "seller_settings"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_domains_verification_token_key" ON "seller_domains"("verification_token");

-- CreateIndex
CREATE INDEX "seller_domains_seller_id_idx" ON "seller_domains"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_domains_seller_id_hostname_key" ON "seller_domains"("seller_id", "hostname");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_labels_slug_key" ON "product_labels"("slug");

-- CreateIndex
CREATE INDEX "asset_media_product_id_version_idx" ON "asset_media"("product_id", "version");

-- CreateIndex
CREATE INDEX "asset_thumbnails_product_id_version_idx" ON "asset_thumbnails"("product_id", "version");

-- CreateIndex
CREATE INDEX "asset_adtexts_product_id_version_idx" ON "asset_adtexts"("product_id", "version");

-- CreateIndex
CREATE INDEX "pricing_rules_product_id_effective_from_idx" ON "pricing_rules"("product_id", "effective_from");

-- CreateIndex
CREATE INDEX "sellpages_seller_id_status_idx" ON "sellpages"("seller_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sellpages_seller_id_slug_key" ON "sellpages"("seller_id", "slug");

-- CreateIndex
CREATE INDEX "fb_connections_seller_id_connection_type_idx" ON "fb_connections"("seller_id", "connection_type");

-- CreateIndex
CREATE UNIQUE INDEX "fb_connections_seller_id_connection_type_external_id_key" ON "fb_connections"("seller_id", "connection_type", "external_id");

-- CreateIndex
CREATE INDEX "ad_strategies_seller_id_idx" ON "ad_strategies"("seller_id");

-- CreateIndex
CREATE INDEX "campaigns_seller_id_sellpage_id_idx" ON "campaigns"("seller_id", "sellpage_id");

-- CreateIndex
CREATE INDEX "campaigns_seller_id_status_idx" ON "campaigns"("seller_id", "status");

-- CreateIndex
CREATE INDEX "adsets_campaign_id_idx" ON "adsets"("campaign_id");

-- CreateIndex
CREATE INDEX "adsets_seller_id_idx" ON "adsets"("seller_id");

-- CreateIndex
CREATE INDEX "ads_adset_id_idx" ON "ads"("adset_id");

-- CreateIndex
CREATE INDEX "ads_seller_id_idx" ON "ads"("seller_id");

-- CreateIndex
CREATE INDEX "ad_posts_seller_id_idx" ON "ad_posts"("seller_id");

-- CreateIndex
CREATE INDEX "ad_posts_ad_id_idx" ON "ad_posts"("ad_id");

-- CreateIndex
CREATE INDEX "orders_seller_id_status_idx" ON "orders"("seller_id", "status");

-- CreateIndex
CREATE INDEX "orders_seller_id_sellpage_id_idx" ON "orders"("seller_id", "sellpage_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_seller_id_order_number_key" ON "orders"("seller_id", "order_number");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_idx" ON "order_events"("order_id");

-- CreateIndex
CREATE INDEX "order_events_seller_id_created_at_idx" ON "order_events"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_stats_raw_seller_id_entity_type_entity_id_date_start_idx" ON "ad_stats_raw"("seller_id", "entity_type", "entity_id", "date_start");

-- CreateIndex
CREATE INDEX "ad_stats_raw_seller_id_fetched_at_idx" ON "ad_stats_raw"("seller_id", "fetched_at");

-- CreateIndex
CREATE INDEX "ad_stats_daily_seller_id_stat_date_idx" ON "ad_stats_daily"("seller_id", "stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_stats_daily_seller_id_entity_type_entity_id_stat_date_key" ON "ad_stats_daily"("seller_id", "entity_type", "entity_id", "stat_date");

-- CreateIndex
CREATE INDEX "sellpage_stats_daily_seller_id_stat_date_idx" ON "sellpage_stats_daily"("seller_id", "stat_date");

-- CreateIndex
CREATE INDEX "sellpage_stats_daily_sellpage_id_stat_date_idx" ON "sellpage_stats_daily"("sellpage_id", "stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "sellpage_stats_daily_seller_id_sellpage_id_stat_date_ad_sou_key" ON "sellpage_stats_daily"("seller_id", "sellpage_id", "stat_date", "ad_source");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_users" ADD CONSTRAINT "seller_users_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_users" ADD CONSTRAINT "seller_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_settings" ADD CONSTRAINT "seller_settings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_domains" ADD CONSTRAINT "seller_domains_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_product_labels" ADD CONSTRAINT "product_product_labels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_product_labels" ADD CONSTRAINT "product_product_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "product_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_media" ADD CONSTRAINT "asset_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_thumbnails" ADD CONSTRAINT "asset_thumbnails_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_adtexts" ADD CONSTRAINT "asset_adtexts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellpages" ADD CONSTRAINT "sellpages_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellpages" ADD CONSTRAINT "sellpages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellpages" ADD CONSTRAINT "sellpages_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "seller_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_connections" ADD CONSTRAINT "fb_connections_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_connections" ADD CONSTRAINT "fb_connections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "fb_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_strategies" ADD CONSTRAINT "ad_strategies_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sellpage_id_fkey" FOREIGN KEY ("sellpage_id") REFERENCES "sellpages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "fb_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ad_strategy_id_fkey" FOREIGN KEY ("ad_strategy_id") REFERENCES "ad_strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adsets" ADD CONSTRAINT "adsets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adsets" ADD CONSTRAINT "adsets_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_adset_id_fkey" FOREIGN KEY ("adset_id") REFERENCES "adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_posts" ADD CONSTRAINT "ad_posts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_posts" ADD CONSTRAINT "ad_posts_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_posts" ADD CONSTRAINT "ad_posts_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "fb_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_posts" ADD CONSTRAINT "ad_posts_asset_media_id_fkey" FOREIGN KEY ("asset_media_id") REFERENCES "asset_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_posts" ADD CONSTRAINT "ad_posts_asset_thumbnail_id_fkey" FOREIGN KEY ("asset_thumbnail_id") REFERENCES "asset_thumbnails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_posts" ADD CONSTRAINT "ad_posts_asset_adtext_id_fkey" FOREIGN KEY ("asset_adtext_id") REFERENCES "asset_adtexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellpage_id_fkey" FOREIGN KEY ("sellpage_id") REFERENCES "sellpages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_stats_raw" ADD CONSTRAINT "ad_stats_raw_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_stats_daily" ADD CONSTRAINT "ad_stats_daily_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellpage_stats_daily" ADD CONSTRAINT "sellpage_stats_daily_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellpage_stats_daily" ADD CONSTRAINT "sellpage_stats_daily_sellpage_id_fkey" FOREIGN KEY ("sellpage_id") REFERENCES "sellpages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

