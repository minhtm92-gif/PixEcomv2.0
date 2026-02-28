-- Add creative_config JSONB column to ad_posts
-- Stores resolved creative data (video URL, thumbnail URL, text fields, ad format)
-- so launch can build Meta ad creative payload without resolving Creative IDs again
ALTER TABLE "ad_posts" ADD COLUMN "creative_config" JSONB NOT NULL DEFAULT '{}';
