-- Milestone 2.3.4-A: Add composite index on ad_stats_daily (entity_id, stat_date)
-- Supports: WHERE entity_id IN (...) AND stat_date BETWEEN x AND y
-- Used by: GET /api/ads-manager/campaigns stats aggregation query

CREATE INDEX IF NOT EXISTS "ad_stats_daily_entity_id_stat_date_idx"
  ON "ad_stats_daily" ("entity_id", "stat_date");
