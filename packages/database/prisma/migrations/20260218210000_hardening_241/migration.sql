-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260218210000_hardening_241
-- Milestone 2.4.1 — Pre-v2.3 Hardening
--
-- Changes:
--   1. Add creative_type enum + column to creatives (Task 1)
--   2. Drop old creative_assets unique index (all roles)
--      Add conditional unique index for single-slot roles only (Task 4)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Task 1: Add creative_type enum ───────────────────────────────────────────

CREATE TYPE "creative_type" AS ENUM (
  'VIDEO_AD',
  'IMAGE_AD',
  'TEXT_ONLY',
  'UGC_BUNDLE'
);

ALTER TABLE "creatives"
  ADD COLUMN "creative_type" "creative_type" NOT NULL DEFAULT 'VIDEO_AD';

-- ── Task 4: Fix creative_assets role uniqueness ───────────────────────────────

-- Drop the old blanket unique index (covers ALL roles including EXTRA)
DROP INDEX IF EXISTS "creative_assets_uq_creative_asset_role";

-- Re-create uniqueness only for single-slot roles (not EXTRA)
-- EXTRA can now appear multiple times per creative.
CREATE UNIQUE INDEX "creative_assets_uq_single_slot_role"
  ON "creative_assets" ("creative_id", "role")
  WHERE "role" != 'EXTRA';

-- Add a composite index to support efficient listing by (creative_id, role)
-- (covers both single-slot lookups and EXTRA enumeration)
CREATE INDEX IF NOT EXISTS "creative_assets_creative_id_role_idx"
  ON "creative_assets" ("creative_id", "role");
