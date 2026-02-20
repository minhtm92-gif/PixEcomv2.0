# Milestone 2.3.4-D Working Log — Orders Read Layer

**Branch:** `feature/2.3.4d-orders-read-layer`
**Base:** `develop` @ `a0b7123`
**Date:** 2026-02-19
**Status:** ✅ COMPLETE — All 241 E2E tests pass (227 existing + 14 new)

---

## Scope

Phase 2.3.4-D ships the **read-only Orders module** for the seller dashboard:

- `GET /api/orders` — paginated order list with keyset cursor pagination
- `GET /api/orders/:id` — full order detail with items + event history

**Explicitly out of scope:** order creation, status mutations, webhook ingestion, fulfillment (all future milestones).

---

## Endpoints

### GET /api/orders

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFrom` | YYYY-MM-DD | today UTC | Start of `createdAt` range |
| `dateTo` | YYYY-MM-DD | today UTC | End of `createdAt` range |
| `sellpageId` | UUID | — | Filter to one sellpage |
| `status` | enum | — | PENDING\|CONFIRMED\|PROCESSING\|SHIPPED\|DELIVERED\|CANCELLED\|REFUNDED |
| `search` | string | — | Order number prefix OR email contains (case-insensitive) |
| `limit` | 1–100 | 20 | Max rows per page |
| `cursor` | string | — | Opaque keyset cursor from `nextCursor` |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "orderNumber": "ORD-001",
      "createdAt": "2026-02-10T10:00:00.000Z",
      "sellpage": { "id": "uuid", "url": "https://domain.com/my-slug" },
      "customer": { "email": "alice@example.com", "name": "Alice Buyer" },
      "total": 155.00,
      "currency": "USD",
      "status": "CONFIRMED",
      "itemsCount": 2
    }
  ],
  "nextCursor": "base64url-cursor-or-null"
}
```

### GET /api/orders/:id

**Response:**
```json
{
  "id": "uuid",
  "orderNumber": "ORD-001",
  "createdAt": "2026-02-10T10:00:00.000Z",
  "sellpage": { "id": "uuid", "url": "https://domain.com/slug" },
  "customer": { "email": "alice@example.com", "name": "Alice", "phone": "+84900000001" },
  "totals": {
    "subtotal": 150.00, "shipping": 5.00, "tax": 0.00,
    "discount": 0.00, "total": 155.00, "currency": "USD"
  },
  "status": "CONFIRMED",
  "items": [
    { "productTitle": "Test Product", "variantTitle": "Size M", "qty": 2, "unitPrice": 75.00, "lineTotal": 150.00 }
  ],
  "events": [
    { "type": "CONFIRMED", "at": "2026-02-10T10:00:00.000Z", "note": "Payment received" }
  ]
}
```

---

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/api/src/orders/orders.service.ts` | List + detail queries, cursor encode/decode |
| `apps/api/src/orders/orders.controller.ts` | GET /orders + GET /orders/:id |
| `apps/api/src/orders/orders.module.ts` | Module registration |
| `apps/api/src/orders/dto/list-orders.dto.ts` | 7 validated query params |
| `apps/api/test/orders.e2e-spec.ts` | 14 E2E tests |
| `packages/database/prisma/migrations/20260219220000_orders_234d/migration.sql` | IF NOT EXISTS index |
| `docs/MILESTONE-2.3.4-D-WORKING-LOG.md` | This file |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Added `OrdersModule` |
| `packages/database/prisma/schema.prisma` | Added `@@index([sellerId, createdAt])` to Order |

---

## Query Strategy

### List (GET /orders)

Single `prisma.order.findMany` with:
- `where: { sellerId, createdAt: { gte, lte }, …optional filters }`
- `select`: only the fields needed for the list contract (no raw DB fields)
- `take: limit + 1` for next-page detection
- `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` — stable sort for keyset pagination
- `_count: { items: true }` — itemsCount in one pass (no join)

### Detail (GET /orders/:id)

Single `prisma.order.findFirst({ where: { id, sellerId } })` — tenant isolation baked into the WHERE. Returns 404 if not found or wrong seller. Includes nested `items` + `events` in the same query.

### Cursor Pagination

Format: `base64url(createdAt.toISOString() + '|' + id)`

Decodes to a (createdAt, id) pair. WHERE clause:
```sql
WHERE (created_at < :cursorCreatedAt)
   OR (created_at = :cursorCreatedAt AND id < :cursorId)
```
This is stable, index-friendly, and opaque to callers.

---

## Migration

**Name:** `20260219220000_orders_234d`

```sql
CREATE INDEX IF NOT EXISTS "orders_seller_id_created_at_idx"
  ON "orders" ("seller_id", "created_at");
```

**Note:** `IF NOT EXISTS` — this index was already created by the `20260219210000_analytics_234c` migration on the `feature/2.3.4c-analytics-overview` branch. Since that branch hasn't merged to develop yet, this migration provides it independently. When both branches merge, the `IF NOT EXISTS` guard makes it safe.

**Applied via:** Direct `psql` + manual `_prisma_migrations` registration.

---

## Tenant Isolation

- **List:** `where.sellerId = sellerId` — hard-coded from JWT, never from params.
- **Detail:** `findFirst({ where: { id, sellerId } })` — both conditions must match. Returns 404 (not 403) to avoid order-ID enumeration attacks.
- **sellpageId filter:** Even if a caller passes a `sellpageId` belonging to another seller, the `sellerId` constraint means no rows are returned.

---

## No-Leak Response Contract

The response maps raw DB fields to clean API names:

| DB field | API field |
|----------|-----------|
| `customerEmail`, `customerName` | `customer.email`, `customer.name` |
| `subtotal`, `shippingCost`, `taxAmount`, `discountAmount`, `total` | `totals.*` |
| `_count.items` | `itemsCount` |
| `productName`, `variantName` | `items[].productTitle`, `items[].variantTitle` |
| `eventType`, `description` | `events[].type`, `events[].note` |

Fields **never** returned: `sellerId`, `shippingAddress`, `paymentId`, `paymentMethod`, `trackingNumber`, `trackingUrl`, `notes`, `updatedAt`.

---

## E2E Test Coverage (14 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | 401 without JWT | Auth guard on list |
| 2 | Empty list for fresh seller | Zero-state response shape |
| 3 | Returns seeded orders with correct shape | Full list contract validation |
| 4 | `sellpageId` filter | Sellpage scoping |
| 5 | `status` filter | Status filter (PENDING only) |
| 6 | `search` by order number prefix | Order number search |
| 7 | `search` by customer email contains | Email search (case-insensitive) |
| 8 | Cursor pagination | nextCursor + non-overlapping page 2 |
| 9 | Tenant isolation | Seller B sees own orders only |
| 10 | Full detail shape (items + events) | Detail contract validation |
| 11 | 404 for other seller's order | Detail isolation |
| 12 | 404 for non-existent order | Not found handling |
| 13 | 400 for non-UUID param | ParseUUIDPipe validation |
| 14 | No raw DB field leakage | Clean response contract |

---

## Curl Examples

```bash
# List today's orders
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders"

# Date range
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders?dateFrom=2026-02-01&dateTo=2026-02-19"

# Filter by status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders?status=CONFIRMED"

# Filter by sellpage
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders?sellpageId=<uuid>"

# Search
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders?search=alice@"

# Cursor pagination
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders?limit=20&cursor=<nextCursor>"

# Order detail
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/orders/<order-id>"
```

---

## Test Summary

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| All E2E | 227 | **241** | +14 |

All 9 existing test suites continued to pass unmodified.
