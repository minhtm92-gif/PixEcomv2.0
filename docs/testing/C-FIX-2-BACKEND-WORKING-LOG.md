# BUG-08 — UUID Validation Fix: Ads-Manager Drilldown Working Log

**Date:** 2026-02-22
**Branch:** `feature/2.4.2-alpha-ads-seed-v1`
**Commit:** `528ab12`
**Author:** Backend Agent (Claude Sonnet 4.6)

---

## Problem

When the frontend drills down into the Ads Manager (Campaigns → Adsets → Ads), it passes
query parameters like `campaignId` and `adsetId` populated from seed data. Seed UUIDs are
version-0 / variant-0 (e.g., `00000000-0000-0000-000a-000000000401`), while the NestJS
`@IsUUID()` decorator (without arguments) validates **RFC 4122 v4 only**.

**Root cause:**
`@IsUUID()` with no argument calls `class-validator`'s UUID v4 check internally.
A v4 UUID requires:
- Version nibble (13th hex digit) = `4`
- Variant nibble (17th hex digit) ∈ `{8, 9, a, b}`

Seed UUIDs have version nibble `0` and variant nibble `0`, so all three DTO validators
rejected them with HTTP 400.

**`ParseUUIDPipe` was also audited** — a grep for `ParseUUIDPipe` + `version` across
`apps/api/src/**` returned zero matches. `ParseUUIDPipe` without a version option accepts
any UUID shape, so no changes were needed there.

---

## Fix

Change `@IsUUID()` → `@IsUUID('all')` in 3 DTO files (5 occurrences total).

`@IsUUID('all')` uses the regex:
```
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```
which accepts any UUID-shaped string regardless of version or variant bits.

---

## Files Changed

### 1. `apps/api/src/ads-manager/dto/adsets-query.dto.ts`

**Before (line 5):**
```typescript
@IsUUID()
campaignId!: string;
```

**After:**
```typescript
@IsUUID('all')
campaignId!: string;
```

---

### 2. `apps/api/src/ads-manager/dto/ads-query.dto.ts`

**Before (line 5):**
```typescript
@IsUUID()
adsetId!: string;
```

**After:**
```typescript
@IsUUID('all')
adsetId!: string;
```

---

### 3. `apps/api/src/ads-manager/dto/filters-query.dto.ts`

**Before (lines 5 and 9):**
```typescript
@IsOptional()
@IsUUID()
campaignId?: string;

@IsOptional()
@IsUUID()
adsetId?: string;
```

**After:**
```typescript
@IsOptional()
@IsUUID('all')
campaignId?: string;

@IsOptional()
@IsUUID('all')
adsetId?: string;
```

---

## Verification

### TypeScript check
```
npx tsc --noEmit  →  no output, exit 0 ✅
```

### Unit tests
```
npm test -- --passWithNoTests

Test Suites: 3 passed, 3 total
Tests:       26 passed, 26 total  ✅
```

All existing tests remain green. No new test added because BUG-08 is a constraint
relaxation (a valid UUID is now a superset), and the drilldown endpoints are covered by
E2E tests in `apps/api/test/ads-manager.e2e-spec.ts` which use seed UUIDs directly.

### Manual curl (seed UUID that previously failed)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/ads-manager/adsets?campaignId=00000000-0000-0000-000a-000000000401"
# Expected: 200 OK with adset list
# Before fix: 400 "campaignId must be a UUID"
```

---

## Impact

| Scope | Effect |
|-------|--------|
| `AdsetsQueryDto.campaignId` | Accepts all UUID formats |
| `AdsQueryDto.adsetId` | Accepts all UUID formats |
| `FiltersQueryDto.campaignId` | Accepts all UUID formats |
| `FiltersQueryDto.adsetId` | Accepts all UUID formats |
| Other DTOs / controllers | No change (were not affected) |
| Database queries | No change (Prisma accepts any string as UUID param) |
| Security | No regression — shape validation still enforced; only version bits relaxed |
