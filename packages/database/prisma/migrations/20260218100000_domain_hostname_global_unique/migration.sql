-- Migration: 20260218100000_domain_hostname_global_unique
-- Adds a global unique constraint on seller_domains.hostname so that
-- the same hostname cannot be registered by two different sellers.
-- The existing per-seller unique (seller_id, hostname) is preserved.

CREATE UNIQUE INDEX "seller_domains_hostname_key" ON "seller_domains"("hostname");
