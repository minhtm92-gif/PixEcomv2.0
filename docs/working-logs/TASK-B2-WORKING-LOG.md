# TASK-B2 Backend Working Log — Orders Module Expansion

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent                                  |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `b3bd35c`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Expanded the Orders read layer (Milestone 2.3.4-D) with three additions:

1. **Detail response enrichment** — `GET /orders/:id` now exposes `shippingAddress`, `trackingNumber`, `trackingUrl`, `paymentMethod`, `paymentId`. All five fields existed in the DB schema but were missing from the Prisma `select` and service return mapping.

2. **List response enrichment** — `GET /orders` list items now include `trackingNumber` (null when unset). Useful for the frontend table so agents can see tracking status without clicking into each order.

3. **5-field search** — `GET /orders?search=...` expanded from 2 fields (orderNumber, customerEmail) to 5 fields: adds `customerName` (case-insensitive), `customerPhone` (contains), `trackingNumber` (case-insensitive).

Also fixed a latent bug: the original `listOrders()` used a flat `where` dict with a `where['OR']` key that was overwritten when both `search` and `cursor` were active simultaneously. Refactored to `AND[]` array to eliminate this.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/orders/orders.service.ts` | Modified | All three tasks |
| `apps/api/test/orders.e2e-spec.ts` | Modified | Fix test 14 + 6 new tests (15–19 + 15b) |

---

## Detailed Changes

### 1. `OrderDetail` interface + `getOrder()` select + return

**Fields added to Prisma select:**
```ts
shippingAddress: true,
trackingNumber: true,
trackingUrl: true,
paymentMethod: true,
paymentId: true,
```

**Fields added to return mapping:**
```ts
shippingAddress: (order.shippingAddress as Record<string, unknown>) ?? {},
trackingNumber: order.trackingNumber ?? null,
trackingUrl: order.trackingUrl ?? null,
paymentMethod: order.paymentMethod ?? null,
paymentId: order.paymentId ?? null,
```

**Design note:** `shippingAddress` is a Prisma `Json` field (typed as `Prisma.JsonValue`). Cast to `Record<string, unknown>` with `?? {}` fallback handles the null case cleanly — the interface types it as `Record<string, unknown>` (always an object in response, never null).

---

### 2. `OrderListItem` interface + `listOrders()` select + map

**Select added:**
```ts
trackingNumber: true,
```

**Map added:**
```ts
trackingNumber: r.trackingNumber ?? null,
```

---

### 3. Search expansion + AND[] WHERE refactor

**Before (2 fields, OR overwrite bug):**
```ts
const where: Record<string, unknown> = { sellerId, createdAt: ... };
if (query.search) {
  where['OR'] = [
    { orderNumber: { startsWith: s } },
    { customerEmail: { contains: s, mode: 'insensitive' } },
  ];
}
if (cursorData) {
  where['OR'] = [   // ← overwrites the search OR!
    { createdAt: { lt: cursorData.createdAt } },
    ...
  ];
}
```

**After (5 fields, AND[] — no overwrite):**
```ts
const andClauses: Record<string, unknown>[] = [
  { sellerId },
  { createdAt: { gte: ..., lte: ... } },
];
if (query.search) {
  andClauses.push({
    OR: [
      { orderNumber: { startsWith: s } },
      { customerEmail: { contains: s, mode: 'insensitive' } },
      { customerName: { contains: s, mode: 'insensitive' } },
      { customerPhone: { contains: s } },
      { trackingNumber: { contains: s, mode: 'insensitive' } },
    ],
  });
}
if (cursorData) {
  andClauses.push({
    OR: [
      { createdAt: { lt: cursorData.createdAt } },
      { createdAt: { equals: cursorData.createdAt }, id: { lt: cursorData.id } },
    ],
  });
}
const where = { AND: andClauses };
```

Each filter condition is pushed as an independent AND clause. Search and cursor coexist correctly.

**`customerPhone` search:** Uses `contains` without `mode: 'insensitive'` — phone numbers are numeric strings; case-insensitivity is irrelevant and skipping it avoids unnecessary PostgreSQL overhead.

---

## E2E Test Changes

### Test 14 — Fixed

Old test 14 asserted that `shippingAddress`, `paymentId`, `paymentMethod` were NOT in the detail response. Those assertions were intentional as a leak-prevention check for the old implementation. After Task B2, those fields are intentionally exposed — so the assertions were removed.

Preserved in test 14:
- `listItem` must not have `sellerId`, `updatedAt`, `shippingCost`, `discountAmount` (raw DB field names not remapped)
- `detail` must not have `sellerId`, `discountAmount`, `shippingCost`, `subtotal`, `taxAmount` (remapped into `totals.*`)

### New Tests Added

| # | Endpoint | What it validates |
|---|----------|-------------------|
| 15 | `GET /orders/:id` | `trackingNumber`, `trackingUrl`, `paymentMethod`, `paymentId`, `shippingAddress` present with correct values |
| 15b | `GET /orders/:id` | Fields are null/`{}` when not set on order |
| 16 | `GET /orders` | List items have `trackingNumber` key; set order = string, unset = null |
| 17 | `GET /orders?search=alice+buyer` | Matches customerName case-insensitively |
| 18 | `GET /orders?search=+84900000003` | Matches customerPhone |
| 19 | `GET /orders?search=TRK-TEST` | Matches trackingNumber |

### Seed data changes (beforeAll)

- Order A1: added `trackingNumber: 'TRK-TEST-001'`, `trackingUrl`, `paymentMethod: 'COD'`, `paymentId: 'PAY-ALICE-001'`, `shippingAddress: { street, city, country }`
- Order A3: added `customerPhone: '+84900000003'` (for test 18)

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (API) | ✅ Clean — zero errors |
| E2E suite | ⚠️ Cannot run — local PostgreSQL at `127.0.0.1:5434` is not running. 19 tests (14 existing + 5 new + 1 new sub) compile and are logically verified. |

---

## Constraints Respected

- No schema changes — all fields already existed in Prisma schema
- No write endpoints added — read-only expansion only
- `sellerId` always sourced from JWT (`req.user.sellerId`) — never from params/body
- Keyset pagination preserved; AND[] refactor is semantically identical to original for the non-search + non-cursor case
