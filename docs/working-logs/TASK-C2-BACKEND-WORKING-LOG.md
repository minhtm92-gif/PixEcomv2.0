# TASK-C2 Working Log — Campaigns CRUD + Meta Lifecycle

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent                                  |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `e634749`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Created the `CampaignsModule` — a full CRUD + Meta lifecycle module for managing ad campaigns. Provides:

1. **CampaignsService** — create, list, detail, update, launch, pause, resume
2. **CampaignsController** — 7 endpoints with JWT-scoped seller isolation
3. **3 DTOs** — CreateCampaignDto, UpdateCampaignDto, ListCampaignsDto

No schema or migration changes — Campaign, Adset, Ad models already exist.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/campaigns/campaigns.module.ts` | **Created** | NestJS module; imports MetaModule, exports CampaignsService |
| `apps/api/src/campaigns/campaigns.service.ts` | **Created** | Full CRUD + launch/pause/resume with Meta API integration |
| `apps/api/src/campaigns/campaigns.controller.ts` | **Created** | 7 routes: POST, GET, GET/:id, PATCH/:id, POST/:id/launch, PATCH/:id/pause, PATCH/:id/resume |
| `apps/api/src/campaigns/dto/create-campaign.dto.ts` | **Created** | name, sellpageId, adAccountId, adStrategyId?, budget, budgetType, startDate?, endDate? |
| `apps/api/src/campaigns/dto/update-campaign.dto.ts` | **Created** | name?, budget?, budgetType?, startDate?, endDate? |
| `apps/api/src/campaigns/dto/list-campaigns.dto.ts` | **Created** | sellpageId?, status?, cursor?, limit? |
| `apps/api/src/app.module.ts` | Modified | Added `CampaignsModule` to imports array |
| `apps/api/test/campaigns.e2e-spec.ts` | **Created** | 21 E2E tests |

---

## Detailed Changes

### 1. Pre-launch State Design

The `CampaignStatus` enum in the schema has `ACTIVE | PAUSED | ARCHIVED | DELETED` — there is no `DRAFT` variant. Pre-launch campaigns are represented using:

- **`status = PAUSED`** on creation
- **`externalCampaignId = null`** as the definitive "not yet pushed to Meta" indicator

**Business rules enforced at service layer:**
| Action | Allowed when |
|--------|-------------|
| `launch` | `externalCampaignId === null` (never launched) |
| `pause` | `status === 'ACTIVE'` AND `externalCampaignId != null` |
| `resume` | `status === 'PAUSED'` AND `externalCampaignId != null` |

This avoids adding a `DRAFT` enum variant to the DB while preserving clear lifecycle semantics.

### 2. Create Flow

```
1. Validate sellpageId → findFirst({ sellerId, id }) → 404 if missing
2. Validate adAccountId → findFirst({ sellerId, connectionType: 'AD_ACCOUNT', isActive: true }) → 400 if missing
3. Validate adStrategyId (if provided) → 404 if not found
4. prisma.campaign.create({ status: 'PAUSED', externalCampaignId: null })
5. Return mapped campaign
```

### 3. Launch Flow

```
1. assertBelongsToSeller (404 if not found)
2. Check externalCampaignId === null → 409 if already launched
3. Load FbConnection.externalId (act_ number)
4. MetaService.post(adAccountId, 'act_{externalId}/campaigns', {
     name, objective: 'OUTCOME_SALES', status: 'ACTIVE', special_ad_categories: []
   })
5. prisma.campaign.update({ externalCampaignId: metaResponse.id, status: 'ACTIVE' })
6. Return updated campaign
```

**Meta API path:** `act_{externalId}/campaigns` — uses FbConnection.externalId (the Meta `act_123456789` ID), not our internal UUID.

### 4. Pause / Resume Flow

**Consistency guarantee:** Meta API is called FIRST. Local DB update only happens after Meta API succeeds. If Meta throws, local status is NOT updated. This prevents local/Meta state divergence.

```
pause:  status=ACTIVE → MetaService.post(campaignId, externalId, {status:'PAUSED'}) → update local PAUSED
resume: status=PAUSED → MetaService.post(campaignId, externalId, {status:'ACTIVE'}) → update local ACTIVE
```

### 5. List Endpoint

Uses the same **keyset pagination** pattern as `OrdersService`:
- Cursor encodes `createdAt|id` as `base64url`
- `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`
- `take: limit + 1` → `hasMore` check → `nextCursor`

List items include enriched fields from Prisma nested selects:
```typescript
sellpage: { id, slug }
adAccount: { id, name, externalId }
adsetsCount: number  // from _count.adsets
```

### 6. Module Wiring

```typescript
// campaigns.module.ts
@Module({
  imports: [MetaModule],    // MetaModule exports MetaService
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})

// app.module.ts — added CampaignsModule to imports
```

`CampaignsService` injects `MetaService` (provided via `MetaModule` import). No circular dependency — `MetaModule` is upstream.

---

## E2E Test Coverage (21 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | POST /campaigns — 401 without JWT | Auth guard |
| 2 | POST /campaigns — 400 missing required fields | DTO validation |
| 3 | POST /campaigns — 404 unknown sellpageId | Sellpage ownership |
| 4 | POST /campaigns — 400 invalid adAccountId | AdAccount validation |
| 5 | POST /campaigns — 201 creates (status=PAUSED, externalId=null) | Happy path create |
| 6 | GET /campaigns — 401 without JWT | Auth guard |
| 7 | GET /campaigns — 200 returns seller campaigns with enriched fields | List happy path |
| 8 | GET /campaigns — filter by status=PAUSED | Status filter |
| 9 | GET /campaigns — filter by sellpageId | SellpageId filter |
| 10 | GET /campaigns/:id — 404 unknown id | Not found |
| 11 | GET /campaigns/:id — 200 with related fields | Detail happy path |
| 12 | GET /campaigns/:id — 404 Seller B accessing Seller A campaign | Tenant isolation |
| 13 | PATCH /campaigns/:id — 400 non-UUID param | ParseUUIDPipe |
| 14 | PATCH /campaigns/:id — 200 updates name/budget | Update happy path |
| 15 | POST /campaigns/:id/launch — 200 sets externalCampaignId + status=ACTIVE | Launch happy path |
| 16 | POST /campaigns/:id/launch — 409 already launched | Launch guard |
| 17 | PATCH /campaigns/:id/pause — 200 sets status=PAUSED | Pause happy path |
| 18 | PATCH /campaigns/:id/pause — 409 not ACTIVE | Pause guard |
| 19 | PATCH /campaigns/:id/resume — 200 sets status=ACTIVE | Resume happy path |
| 20 | PATCH /campaigns/:id/resume — 409 not PAUSED | Resume guard |
| 21 | POST /campaigns/:id/launch — 404 tenant isolation | Cross-tenant launch blocked |

**MetaService mocked via `jest.spyOn`** — no real Meta API calls in tests.

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (API) | ✅ Clean — zero errors |
| E2E — DB-dependent tests | ⚠️ Skipped — requires live PostgreSQL on port 5434 |
| E2E — test structure | ✅ 21 tests compile and load correctly |

---

## Constraints Respected

- No schema/migration changes — Campaign model was already in place
- `sellerId` always from JWT — never from params/body
- Meta API called before local DB update (launch/pause/resume consistency)
- `CampaignStatus.DRAFT` absent from enum — pre-launch state uses `PAUSED + externalCampaignId=null`
- List endpoint uses keyset pagination (consistent with OrdersService pattern)
- `adAccountId` validated for type=AD_ACCOUNT + isActive=true before campaign creation
