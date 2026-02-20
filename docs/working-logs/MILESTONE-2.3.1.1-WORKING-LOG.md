# Milestone 2.3.1.1 Working Log — FB Connections Hardening

**Branch:** `feature/2.3.1.1-connections-hardening`
**Base:** `feature/2.3.1-fb-connections-ad-strategies` @ `2525595`
**Commits:** `145259f` → `709a81c` → `043e76d`
**Merged to develop:** `a0b7123`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — 227 E2E tests pass (209 existing + 18 new)

---

## Scope

Pre-2.3.2 hardening pass on the FB Connections + Ad Strategies modules:

1. **Connection hierarchy** — Parent/child connection relationships (e.g. Pixel linked to Ad Account)
2. **Soft disable** — `isActive=false` propagates to child connections, filters from active queries
3. **isActive indexes** — Performance indexes on both `fb_connections` and `ad_strategies`

---

## Changes

### Database (`145259f`)

Added composite indexes for efficient `isActive` filtered queries:

```sql
CREATE INDEX "fb_connections_seller_id_is_active_idx"
  ON "fb_connections" ("seller_id", "is_active");

CREATE INDEX "ad_strategies_seller_id_is_active_idx"
  ON "ad_strategies" ("seller_id", "is_active");
```

**Migration:** `packages/database/prisma/migrations/20260219_connections_hardening/migration.sql`

### API Fixes (`709a81c`)

- `FbConnectionsService.disableConnection()` — when a connection is soft-disabled (`isActive=false`), recursively disables all child connections with the same seller scope
- `FbConnectionsService.listConnections()` — filters `isActive=true` by default unless `includeInactive=true` query param passed
- Validates parent/child hierarchy on creation — parent must belong to same seller

### E2E Tests (`043e76d`)

18 new tests added to `test/fb-connections-ad-strategies.e2e-spec.ts`:

| # | Test |
|---|------|
| 1–6 | Connection hierarchy creation + validation |
| 7–10 | Soft disable propagates to children |
| 11–14 | isActive filter on list endpoint |
| 15–18 | Ad strategies isActive filtering |

---

## Files Changed

| File | Change |
|------|--------|
| `packages/database/prisma/migrations/20260219_connections_hardening/migration.sql` | New — 2 indexes |
| `apps/api/src/fb-connections/fb-connections.service.ts` | Hierarchy + soft disable logic |
| `apps/api/test/fb-connections-ad-strategies.e2e-spec.ts` | +18 E2E tests |

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 209 | **227** | +18 |
