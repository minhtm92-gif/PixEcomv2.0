# TASK-C4 Working Log — Adset + Ad CRUD + AdPost Linking

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent                                  |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `52bb127`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Created `AdUnitsModule` — a single module housing Adset CRUD, Ad CRUD, and AdPost linking. Extends the Campaigns hierarchy: Campaign → Adset → Ad → AdPost.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/ad-units/ad-units.module.ts` | **Created** | Registers 4 controllers + AdUnitsService |
| `apps/api/src/ad-units/ad-units.service.ts` | **Created** | All Adset/Ad/AdPost business logic |
| `apps/api/src/ad-units/adsets.controller.ts` | **Created** | Two controllers: nested + top-level adset routes |
| `apps/api/src/ad-units/ads.controller.ts` | **Created** | Two controllers: nested + top-level ad routes |
| `apps/api/src/ad-units/dto/create-adset.dto.ts` | **Created** | name, optimizationGoal?, targeting? |
| `apps/api/src/ad-units/dto/update-adset.dto.ts` | **Created** | name?, optimizationGoal?, targeting?, status? |
| `apps/api/src/ad-units/dto/create-ad.dto.ts` | **Created** | name |
| `apps/api/src/ad-units/dto/update-ad.dto.ts` | **Created** | name?, status? |
| `apps/api/src/ad-units/dto/create-ad-post.dto.ts` | **Created** | pageId, postSource, externalPostId?, asset IDs? |
| `apps/api/src/app.module.ts` | Modified | Added `AdUnitsModule` import |
| `apps/api/test/ad-units.e2e-spec.ts` | **Created** | 24 E2E tests |

---

## Architecture Decision: Single Module with Multiple Controllers

Rather than creating separate `AdsetsModule` and `AdsModule`, all logic lives in `AdUnitsModule` with:
- **Single service** (`AdUnitsService`) — one `PrismaService` dependency, no circular refs
- **4 controllers** — split by URL prefix to match NestJS routing:

| Controller | Prefix | Routes |
|------------|--------|--------|
| `CampaignAdsetsController` | `campaigns/:campaignId/adsets` | POST, GET |
| `AdsetsController` | `adsets` | GET/:id, PATCH/:id |
| `AdsetAdsController` | `adsets/:adsetId/ads` | POST, GET |
| `AdsController` | `ads` | GET/:id, PATCH/:id, POST/:adId/ad-post |

This avoids creating 2+ modules and cross-module imports.

---

## Endpoint Map

```
POST   /api/campaigns/:campaignId/adsets          → createAdset
GET    /api/campaigns/:campaignId/adsets          → listAdsets
GET    /api/adsets/:id                            → getAdset
PATCH  /api/adsets/:id                            → updateAdset

POST   /api/adsets/:adsetId/ads                   → createAd
GET    /api/adsets/:adsetId/ads                   → listAds
GET    /api/ads/:id                               → getAd (includes adPosts[])
PATCH  /api/ads/:id                               → updateAd

POST   /api/ads/:adId/ad-post                     → createAdPost
```

---

## Cascade Validation Logic

### Adset Create
```
1. Campaign findFirst({ id: campaignId, sellerId }) → 404 if not found
2. If campaign.status === 'DELETED' → 400
3. Create adset: status=PAUSED (pre-launch state, mirrors Campaign pattern)
```

### Ad Create
```
1. Adset findFirst({ id: adsetId, sellerId }, include: campaign.status) → 404 if not found
2. If campaign.status === 'DELETED' → 400
3. Create ad: status=PAUSED
```

### AdPost Create
```
1. Ad findFirst({ id: adId, sellerId }) → 404 if not found
2. FbConnection findFirst({ id: pageId, sellerId, connectionType: 'PAGE', isActive: true }) → 400 if not found
3. AssetMedia.findUnique(assetMediaId) → 404 if not found (if provided)
4. AssetThumbnail.findUnique(assetThumbnailId) → 404 if not found (if provided)
5. AssetAdtext.findUnique(assetAdtextId) → 404 if not found (if provided)
6. Create AdPost
```

---

## Pagination Pattern

All list endpoints use **keyset pagination** (`createdAt ASC, id ASC` — ascending for sub-resources, consistent with creation order):

```typescript
cursor = base64url(createdAt.toISOString() + '|' + id)
// OR clause for keyset:
{ createdAt: { lt: cursor.createdAt } }
// OR same timestamp, smaller id
{ createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } }
```

List items are enriched with `_count`:
- Adset list items: `adsCount`
- Ad list items: `adPostsCount`

Ad detail includes full `adPosts[]` array (ordered `createdAt DESC`).

---

## E2E Test Coverage (24 tests)

| # | Area | Test |
|---|------|------|
| 1-4 | Adset create | 401, 404 unknown campaign, 400 missing name, 400 DELETED campaign |
| 5 | Adset create | 201 creates (status=PAUSED, targeting serialized) |
| 6-7 | Adset list | 200 with adsCount, 404 unknown campaignId |
| 8-10 | Adset detail | 200 with campaign relation, 404 unknown, 404 tenant isolation |
| 11-12 | Adset update | 200 updates name+status, 400 no fields |
| 13-15 | Ad create | 401, 404 unknown adset, 201 creates (status=PAUSED) |
| 16 | Ad list | 200 with adPostsCount |
| 17-19 | Ad detail | 200 with adset+adPosts[], 404 unknown, 404 tenant isolation |
| 20 | Ad update | 200 updates name |
| 21 | AdPost create | 400 invalid pageId (wrong connectionType) |
| 22 | AdPost create | 201 creates with externalPostId |
| 23 | Ad detail | adPosts[] includes newly created post |
| 24 | AdPost create | 404 unknown adId |

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (API) | ✅ Clean — zero errors |
| E2E — DB-dependent | ⚠️ Skipped — requires live PostgreSQL on port 5434 |
| E2E — compilation | ✅ 24 tests compile correctly |

---

## Constraints Respected

- No schema/migration changes — Adset, Ad, AdPost models already in place
- `sellerId` always from JWT — never from params/body
- `pageId` validated as FbConnection(type=PAGE, isActive=true) for seller
- Asset IDs validated individually if provided (not required for AdPost)
- Pre-launch state: `status=PAUSED` on create (mirrors CampaignsModule pattern)
- List endpoints: keyset pagination consistent with OrdersService/CampaignsService
