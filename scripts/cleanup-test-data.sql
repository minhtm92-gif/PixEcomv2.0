-- PixEcom Cleanup Script
-- Run on production DB: psql -U pixecom -d pixecom -f cleanup-test-data.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Delete 3 test orders (cascade: order_items, order_events, reviews)
-- ═══════════════════════════════════════════════════════════════════════════════

-- First, show what we're about to delete
SELECT id, order_number, customer_email, status, total, created_at
FROM orders
WHERE order_number IN ('ORD-20260226-J0ZK', 'ORD-20260226-A7NT', 'ORD-20260226-LVYI');

-- Delete order events
DELETE FROM order_events
WHERE order_id IN (
  SELECT id FROM orders
  WHERE order_number IN ('ORD-20260226-J0ZK', 'ORD-20260226-A7NT', 'ORD-20260226-LVYI')
);

-- Delete order items
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE order_number IN ('ORD-20260226-J0ZK', 'ORD-20260226-A7NT', 'ORD-20260226-LVYI')
);

-- Delete reviews linked to these orders
DELETE FROM reviews
WHERE order_id IN (
  SELECT id FROM orders
  WHERE order_number IN ('ORD-20260226-J0ZK', 'ORD-20260226-A7NT', 'ORD-20260226-LVYI')
);

-- Delete the orders
DELETE FROM orders
WHERE order_number IN ('ORD-20260226-J0ZK', 'ORD-20260226-A7NT', 'ORD-20260226-LVYI');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Remove mock FB connections (act_123456, act_789012)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Show any mock connections
SELECT id, seller_id, external_id, name, connection_type, is_active
FROM fb_connections
WHERE external_id IN ('act_123456', 'act_789012');

-- Delete campaigns linked to mock ad accounts
DELETE FROM campaign_creatives
WHERE campaign_id IN (
  SELECT c.id FROM campaigns c
  JOIN fb_connections fb ON c.ad_account_id = fb.id
  WHERE fb.external_id IN ('act_123456', 'act_789012')
);

DELETE FROM ad_stats_daily
WHERE entity_id IN (
  SELECT c.id FROM campaigns c
  JOIN fb_connections fb ON c.ad_account_id = fb.id
  WHERE fb.external_id IN ('act_123456', 'act_789012')
) AND entity_type = 'CAMPAIGN';

DELETE FROM campaigns
WHERE ad_account_id IN (
  SELECT id FROM fb_connections
  WHERE external_id IN ('act_123456', 'act_789012')
);

-- Delete the mock FB connections
DELETE FROM fb_connections
WHERE external_id IN ('act_123456', 'act_789012');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Diagnostic: Show user/seller mapping for campaign visibility issue
-- ═══════════════════════════════════════════════════════════════════════════════

-- Show all users and their seller associations
SELECT u.id AS user_id, u.display_name, u.email, su.seller_id, s.name AS seller_name, su.role
FROM users u
JOIN seller_users su ON u.id = su.user_id
JOIN sellers s ON su.seller_id = s.id
WHERE u.is_active = true
ORDER BY s.name, u.display_name;

-- Show FB connections and which user connected them
SELECT fb.id, fb.seller_id, fb.connected_by_user_id, fb.external_id, fb.name,
       fb.connection_type, fb.is_active, u.display_name AS connected_by
FROM fb_connections fb
LEFT JOIN users u ON fb.connected_by_user_id = u.id
ORDER BY fb.seller_id, fb.connection_type;

-- Show campaigns and their ad account owner
SELECT c.id, c.name AS campaign_name, c.seller_id, c.ad_account_id,
       fb.external_id AS ad_account_ext_id, fb.name AS ad_account_name,
       fb.connected_by_user_id, u.display_name AS ad_account_owner
FROM campaigns c
JOIN fb_connections fb ON c.ad_account_id = fb.id
LEFT JOIN users u ON fb.connected_by_user_id = u.id
ORDER BY c.seller_id, c.name;
