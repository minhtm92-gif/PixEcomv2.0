# TASK-B6 Backend Working Log — Sellpage Linked Ads Endpoint

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent                                  |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `14f0056`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Added a read-only endpoint `GET /api/sellpages/:id/linked-ads` that traverses the full ad chain for a sellpage: **Campaign → Adset → Ad → AdPost**.

The implementation uses a single Prisma query with nested `select` blocks — no N+1 queries regardless of how many campaigns/adsets/ads are linked to the sellpage.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/sellpages/sellpages.service.ts` | Modified | Added `getLinkedAds()` method |
| `apps/api/src/sellpages/sellpages.controller.ts` | Modified | Added `GET :id/linked-ads` route |
| `apps/api/test/sellpages-linked-ads.e2e-spec.ts` | **Created** | 10 E2E tests |

---

## Detailed Changes

### 1. `sellpages.service.ts` — `getLinkedAds()`

**Method signature:**
```typescript
async getLinkedAds(sellerId: string, sellpageId: string)
```

**Implementation:**

Step 1 — Ownership check (2-field lookup):
```typescript
const sellpage = await this.prisma.sellpage.findUnique({
  where: { id: sellpageId },
  select: { id: true, sellerId: true },
});
if (!sellpage || sellpage.sellerId !== sellerId) {
  throw new NotFoundException('Sellpage not found');
}
```

Step 2 — Single query traversal:
```typescript
const campaigns = await this.prisma.campaign.findMany({
  where: { sellpageId, sellerId },
  orderBy: { createdAt: 'desc' },
  select: {
    id, name, status,
    adsets: {
      orderBy: { createdAt: 'asc' },
      select: {
        id, name, status,
        ads: {
          orderBy: { createdAt: 'asc' },
          select: {
            id, name, status,
            adPosts: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { externalPostId, pageId, createdAt },
            },
          },
        },
      },
    },
  },
});
```

**Response shape:**
```typescript
{
  campaigns: [{
    id: string,
    name: string,
    status: string,
    adsets: [{
      id: string,
      name: string,
      status: string,
      ads: [{
        id: string,
        name: string,
        status: string,
        adPost: { externalPostId: string | null, pageId: string, createdAt: Date } | null
      }]
    }]
  }]
}
```

**Design decisions:**

- **Single Prisma query**: Prisma translates nested `select` with `findMany` into a series of `IN` queries — one per level — not N+1 individual queries. For the typical case (few campaigns per sellpage), this is efficient and simple.

- **`adPosts.take(1)`**: An Ad may technically have multiple AdPost rows. We surface only the most recent (`orderBy: { createdAt: 'desc' }, take: 1`). This gives a stable, predictable response without returning arrays within arrays.

- **`adPost: null` when no AdPost**: The mapping checks `ad.adPosts.length > 0` and returns `null` otherwise — makes the consumer's null-check straightforward.

- **`sellerId` filter on Campaign query**: Even though the sellpage is already validated to belong to the seller, we also filter campaigns by `sellerId` as defence-in-depth. This also leverages the `@@index([sellerId, sellpageId])` index on campaigns.

- **Ordering**: Campaigns newest-first (`createdAt: 'desc'`) — matches the typical UI expectation of showing newest campaigns at top. Adsets and Ads oldest-first (`createdAt: 'asc'`) — they are sub-items; ascending is more natural for sequential entities within a campaign.

- **No pagination**: The linked-ads view is a tree traversal for a single sellpage. In practice the depth is bounded (a sellpage has at most a handful of campaigns in a given period). Pagination would add complexity with no practical benefit at Phase 1 data volumes.

---

### 2. `sellpages.controller.ts` — new route

```typescript
@Get(':id/linked-ads')
@HttpCode(HttpStatus.OK)
async getLinkedAds(
  @CurrentUser() user: AuthUser,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.sellpagesService.getLinkedAds(user.sellerId, id);
}
```

**Route ordering note**: In NestJS, `GET :id/linked-ads` is a distinct route from `GET :id` — NestJS correctly disambiguates because `/linked-ads` is a literal segment that doesn't match an empty string. No special ordering was required. The route was added before `PATCH :id` for readability.

**`ParseUUIDPipe`**: Non-UUID `:id` values return 400 before even hitting the service, consistent with all other parameterized routes in the controller.

---

## E2E Test Coverage

File: `apps/api/test/sellpages-linked-ads.e2e-spec.ts` — **10 tests**

| # | What it validates |
|---|-------------------|
| 1 | 401 without JWT |
| 2 | 400 for non-UUID sellpageId |
| 3 | 404 for unknown sellpageId |
| 4 | Empty `campaigns: []` when sellpage has no campaigns |
| 5 | Full chain shape: campaigns → adsets → ads → adPost fields |
| 6 | `adPost: null` when ad has no AdPost |
| 7 | Campaigns ordered by createdAt DESC (newest first) |
| 8 | Multiple adsets under one campaign all returned |
| 9 | `adPost` exposes only `externalPostId`, `pageId`, `createdAt` (no internal fields) |
| 10 | Tenant isolation: Seller B gets 404 on Seller A's sellpage |

**Seed setup per test suite:**
- 2 sellers (A, B)
- 1 product + 2 sellpages for Seller A (one with campaigns, one empty)
- 2 FbConnections (AD_ACCOUNT + PAGE)
- 2 campaigns, 2 adsets (both under Campaign 1), 2 ads (both under Adset 1)
- 1 AdPost (on Ad 1 only) — Ad 2 has no AdPost for null-check test

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (API) | ✅ Clean — zero errors |
| E2E suite | ⚠️ Cannot run — local PostgreSQL at `127.0.0.1:5434` is not running. All 10 test cases compile and are logically verified. |

---

## Constraints Respected

- `sellerId` always from JWT — never from route params/body
- Read-only endpoint — no mutations
- Single Prisma query (nested selects) — no N+1
- `ParseUUIDPipe` on `:id` param — invalid UUIDs return 400 before service call
- Ownership validated before chain query — 404 on unknown or cross-tenant sellpage
- Response shape exposes only specified fields — no raw DB internals
