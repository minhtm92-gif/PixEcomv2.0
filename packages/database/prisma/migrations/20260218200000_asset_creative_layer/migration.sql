-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260218200000_asset_creative_layer
-- Adds the multi-source asset registry + creative bundle layer.
--
-- Key notes:
--  1. ALTER TYPE ... ADD VALUE IF NOT EXISTS is used for extending media_type
--     with 'TEXT'. PostgreSQL 16 supports this inside a transaction.
--  2. Partial unique indexes (WHERE clause) cannot be expressed in Prisma
--     schema — they are created here as raw SQL only.
--     - assets(owner_seller_id, checksum) WHERE checksum IS NOT NULL
--     - assets(source_type, ingestion_id) WHERE ingestion_id IS NOT NULL
--     (Prisma schema has @@unique([sourceType, ingestionId]) but the partial
--     version is what we actually want in the DB.)
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Extend existing media_type enum with TEXT
ALTER TYPE "media_type" ADD VALUE IF NOT EXISTS 'TEXT';

-- Step 2: Create new enum types
CREATE TYPE "asset_source_type" AS ENUM (
  'PIXCON',
  'USER_UPLOAD',
  'PARTNER_API',
  'MIGRATION',
  'SYSTEM'
);

CREATE TYPE "creative_status" AS ENUM (
  'DRAFT',
  'READY',
  'ARCHIVED'
);

CREATE TYPE "creative_asset_role" AS ENUM (
  'PRIMARY_VIDEO',
  'THUMBNAIL',
  'PRIMARY_TEXT',
  'HEADLINE',
  'DESCRIPTION',
  'EXTRA'
);

-- Step 3: Create assets table
CREATE TABLE "assets" (
  "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
  "owner_seller_id" UUID,
  "source_type"     "asset_source_type" NOT NULL,
  "ingestion_id"    VARCHAR(255),
  "media_type"      "media_type"  NOT NULL,
  "url"             VARCHAR(1000) NOT NULL,
  "storage_key"     VARCHAR(500),
  "mime_type"       VARCHAR(100),
  "file_size_bytes" BIGINT,
  "duration_sec"    INTEGER,
  "width"           INTEGER,
  "height"          INTEGER,
  "checksum"        VARCHAR(64),
  "metadata"        JSONB         NOT NULL DEFAULT '{}',
  "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- FK: ownerSeller (nullable — NULL = platform asset)
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_owner_seller_id_fkey"
  FOREIGN KEY ("owner_seller_id")
  REFERENCES "sellers" ("id")
  ON DELETE CASCADE;

-- Standard composite index for scoped listing
CREATE INDEX "assets_owner_seller_id_media_type_idx"
  ON "assets" ("owner_seller_id", "media_type");

-- Partial unique: de-dup by ingestion_id per source (only when ingestion_id provided)
CREATE UNIQUE INDEX "assets_uq_ingestion_id"
  ON "assets" ("source_type", "ingestion_id")
  WHERE "ingestion_id" IS NOT NULL;

-- Partial unique: de-dup by checksum per owner (only when checksum provided)
CREATE UNIQUE INDEX "assets_uq_checksum"
  ON "assets" ("owner_seller_id", "checksum")
  WHERE "checksum" IS NOT NULL;

-- Step 4: Create creatives table
CREATE TABLE "creatives" (
  "id"         UUID             NOT NULL DEFAULT gen_random_uuid(),
  "seller_id"  UUID             NOT NULL,
  "product_id" UUID,
  "name"       VARCHAR(255)     NOT NULL,
  "status"     "creative_status" NOT NULL DEFAULT 'DRAFT',
  "metadata"   JSONB            NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "creatives"
  ADD CONSTRAINT "creatives_seller_id_fkey"
  FOREIGN KEY ("seller_id")
  REFERENCES "sellers" ("id")
  ON DELETE CASCADE;

ALTER TABLE "creatives"
  ADD CONSTRAINT "creatives_product_id_fkey"
  FOREIGN KEY ("product_id")
  REFERENCES "products" ("id")
  ON DELETE SET NULL;

CREATE INDEX "creatives_seller_id_status_idx"
  ON "creatives" ("seller_id", "status");

-- Step 5: Create creative_assets join table
CREATE TABLE "creative_assets" (
  "id"          UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "creative_id" UUID                 NOT NULL,
  "asset_id"    UUID                 NOT NULL,
  "role"        "creative_asset_role" NOT NULL,

  CONSTRAINT "creative_assets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "creative_assets"
  ADD CONSTRAINT "creative_assets_creative_id_fkey"
  FOREIGN KEY ("creative_id")
  REFERENCES "creatives" ("id")
  ON DELETE CASCADE;

ALTER TABLE "creative_assets"
  ADD CONSTRAINT "creative_assets_asset_id_fkey"
  FOREIGN KEY ("asset_id")
  REFERENCES "assets" ("id")
  ON DELETE CASCADE;

-- One slot per role per creative
CREATE UNIQUE INDEX "creative_assets_uq_creative_asset_role"
  ON "creative_assets" ("creative_id", "role");

CREATE INDEX "creative_assets_asset_id_idx"
  ON "creative_assets" ("asset_id");

-- Step 6: Create campaign_creatives join table
CREATE TABLE "campaign_creatives" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID        NOT NULL,
  "creative_id" UUID        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "campaign_creatives_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "campaign_creatives"
  ADD CONSTRAINT "campaign_creatives_campaign_id_fkey"
  FOREIGN KEY ("campaign_id")
  REFERENCES "campaigns" ("id")
  ON DELETE CASCADE;

ALTER TABLE "campaign_creatives"
  ADD CONSTRAINT "campaign_creatives_creative_id_fkey"
  FOREIGN KEY ("creative_id")
  REFERENCES "creatives" ("id")
  ON DELETE CASCADE;

CREATE UNIQUE INDEX "campaign_creatives_uq_campaign_creative"
  ON "campaign_creatives" ("campaign_id", "creative_id");

CREATE INDEX "campaign_creatives_creative_id_idx"
  ON "campaign_creatives" ("creative_id");
