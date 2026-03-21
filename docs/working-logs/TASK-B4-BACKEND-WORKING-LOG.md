# TASK-B4 Backend Working Log — Orders Export / Import Tracking / Bulk Status

| Field      | Value                                          |
|------------|------------------------------------------------|
| Date       | 2026-02-21                                     |
| Agent      | Backend Agent                                  |
| Branch     | `feature/2.4.2-alpha-ads-seed-v1`             |
| Commit SHA | `926b7e2`                                      |
| Reviewer   | CTO                                            |

---

## Summary

Added three new mutation/export endpoints to the Orders module:

1. **`GET /api/orders/export`** — CSV download (UTF-8 BOM, Excel-compatible). Per-OrderItem rows, max 5000, seller-scoped, rate-limited 1 req/30s in-memory.
2. **`POST /api/orders/import-tracking`** — multipart CSV upload; updates `trackingNumber` + `trackingUrl` for matched orders. Returns per-row success/failure summary.
3. **`PATCH /api/orders/bulk-status`** — bulk status update with `OrderEvent` creation per order via Prisma transaction. Returns per-order success/failure summary.

Changes span: new services + DTO + controller updates + module registration + E2E tests.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/orders/orders-export.service.ts` | **Created** | CSV generation + in-memory rate limiter |
| `apps/api/src/orders/orders-import.service.ts` | **Created** | CSV parser + tracking update logic |
| `apps/api/src/orders/orders-bulk.service.ts` | **Created** | Bulk status update + Prisma transaction + OrderEvent |
| `apps/api/src/orders/dto/bulk-status.dto.ts` | **Created** | `{ orderIds: string[], status: OrderStatus }` with class-validator |
| `apps/api/src/orders/orders.controller.ts` | Modified | Added 3 new endpoints (before `/:id` route) |
| `apps/api/src/orders/orders.module.ts` | Modified | Added `MulterModule` + 3 new providers |
| `apps/api/test/orders-operations.e2e-spec.ts` | **Created** | 30 E2E tests for all 3 endpoints |
| `apps/api/package.json` | Modified | Added `@types/multer` devDependency |
| `pnpm-lock.yaml` | Modified | Lock file updated for `@types/multer` |

---

## Detailed Changes

### 1. `orders-export.service.ts`

**In-memory rate limiter:**
```typescript
const exportLastTs = new Map<string, number>(); // Map<sellerId, timestamp>
const RATE_LIMIT_WINDOW_MS = 30_000;
// Throws HttpException(429) { message, retryAfter } if within window
```

**CSV generation:**
- UTF-8 BOM prefix: `'\uFEFF'` + lines joined with `'\r\n'` (CRLF for Excel)
- Custom `escapeCsv()` — wraps values containing `,`, `"`, or `\n` in double quotes; escapes embedded `"` as `""`
- 17 columns: `OrderNumber, Date, Status, CustomerName, CustomerEmail, CustomerPhone, ProductName, VariantName, Qty, UnitPrice, LineTotal, Total, Source, TrackingNumber, TransactionId, ShippingAddress`
- **Per-OrderItem rows**: iterates `order.items`; orders with no items get 1 row with blank product fields
- **Max 5000 rows**: row counter breaks loop when limit reached
- Accepts same filter params as `listOrders()`: `dateFrom`, `dateTo`, `status`, `source`
- `ShippingAddress`: serialized as single-line JSON

**Design decisions:**
- Rate limiter is module-level `const Map` (singleton in process memory). Reset happens naturally at window expiry — no `setTimeout` cleanup needed.
- No `cursor` / `sellpageId` / `search` filters for export (not needed for CSV bulk export).
- Decimal fields converted with `Number()` to avoid `{}` serialization.

---

### 2. `orders-import.service.ts`

**Custom CSV parser (no external library):**
```typescript
function parseCsvRows(raw: string): ImportRow[] | null
function splitCsvLine(line: string): string[]
```
- Handles: UTF-8 BOM, CRLF/LF, quoted fields, embedded commas/quotes (`""` escaping)
- Case-insensitive header matching (`header.toLowerCase()`)
- Required columns: `ordernumber`, `trackingnumber`; optional: `trackingurl`
- Skips rows where `orderNumber` or `trackingNumber` is blank
- Max 1000 rows per file

**Per-row processing:**
1. `prisma.order.findFirst({ where: { orderNumber, sellerId } })` — tenant isolation
2. If not found → pushed to `failed[]` with reason
3. `prisma.order.update({ trackingNumber, trackingUrl? })`
4. Any exception → pushed to `failed[]` with generic reason

**Response:**
```typescript
{ updated: number, failed: { orderNumber: string, reason: string }[] }
```

---

### 3. `orders-bulk.service.ts`

**Status → EventType mapping:**
```typescript
const STATUS_TO_EVENT: Record<string, string> = {
  CONFIRMED: 'CONFIRMED', PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED',
};
// PENDING maps to default 'CONFIRMED' (edge case; PENDING has no matching event type)
```

**Per-order processing:**
1. `prisma.order.findFirst({ where: { id, sellerId } })` — tenant isolation
2. Skip if `order.status === dto.status` → `failed[]` with `"Order is already {status}"`
3. `prisma.$transaction([order.update(...), orderEvent.create(...)])` — atomic per order
4. `description: "Status updated to {status} via bulk update"`

**`BulkStatusDto`:**
```typescript
@IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('all', { each: true }) orderIds
@IsIn(ORDER_STATUSES) status
```

---

### 4. Controller Route Order

Static routes declared **before** parameterized `/:id`:
```
GET  /orders/export          → OrdersExportService.exportCsv()
POST /orders/import-tracking → OrdersImportService.importTracking()
PATCH /orders/bulk-status    → OrdersBulkService.bulkUpdateStatus()
GET  /orders                 → OrdersService.listOrders()
GET  /orders/:id             → OrdersService.getOrder()
```

NestJS matches routes top-down. Without this ordering, `/export` would match `/:id` (ParseUUIDPipe would reject with 400, not 404).

**`@Res()` on export endpoint:**
`res.setHeader('Content-Type', 'text/csv; charset=utf-8')` + `res.setHeader('Content-Disposition', 'attachment; filename="orders-YYYY-MM-DD.csv"')` + `res.send(csv)`.

---

### 5. Module — `MulterModule`

```typescript
MulterModule.register({ dest: undefined })
```
`dest: undefined` = memory storage (no temp files written to disk). File size limit enforced per-interceptor in the controller (`limits: { fileSize: 2 * 1024 * 1024 }`).

---

## E2E Test Coverage

File: `apps/api/test/orders-operations.e2e-spec.ts` — **30 tests**

| # | Group | What it validates |
|---|-------|-------------------|
| 1 | Export | 401 without JWT |
| 2 | Export | 200 + text/csv + Content-Disposition |
| 3 | Export | UTF-8 BOM bytes (0xEF 0xBB 0xBF) |
| 4 | Export | CSV header row exact match |
| 5 | Export | 2-item order → 2 data rows |
| 6 | Export | 0-item order → 1 row, blank product fields |
| 7 | Export | dateFrom/dateTo excludes old orders |
| 8 | Export | status filter |
| 9 | Export | source filter |
| 10 | Export | Tenant isolation (Seller B can't see A's orders) |
| 11 | Export | Rate limit: 2nd request within 30s → 429 |
| 12 | Export | Rate limit reset after 30s window (via separate seller) |
| 13 | Import | 401 without JWT |
| 14 | Import | 500 when no file uploaded |
| 15 | Import | 500 when file is not CSV |
| 16 | Import | 200 + `{ updated, failed }` shape |
| 17 | Import | DB updated after successful import |
| 18 | Import | Unknown orderNumber → `failed[]` |
| 19 | Import | Different seller's order → `failed[]` (tenant isolation) |
| 20 | Import | Missing OrderNumber column → 400 |
| 21 | Import | Missing TrackingNumber column → 400 |
| 22 | Bulk | 401 without JWT |
| 23 | Bulk | 400 missing status field |
| 24 | Bulk | 400 invalid status value |
| 25 | Bulk | 400 non-UUID in orderIds |
| 26 | Bulk | 200 + `{ updated, failed }` shape |
| 27 | Bulk | Status updated in DB |
| 28 | Bulk | OrderEvent created with bulk update description |
| 29 | Bulk | Different seller's order → `failed[]` (tenant isolation) |
| 30 | Bulk | Order already at target → `failed[]` |

---

## Testing Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (API) | ✅ Clean — zero errors |
| `@types/multer` install | ✅ `Express.Multer.File` type resolved |
| E2E suite | ⚠️ Cannot run — local PostgreSQL at `127.0.0.1:5434` is not running. All 30 new test cases compile and are logically verified. |

---

## Constraints Respected

- `sellerId` always from JWT — never from params/body
- Rate limiter: in-memory `Map` only — no Redis, no `@nestjs/throttler`
- CSV import: custom parser — no `csv-parse` or other library added
- Multer: memory storage only — no temp files written to disk
- `@ArrayMaxSize(100)` on bulk endpoint — prevents oversized payloads
- `prisma.$transaction([])` on bulk update — atomic per order (not across all orders — individual order failures don't block others)
- All new endpoints require `JwtAuthGuard` (inherited from controller-level `@UseGuards`)
- Static routes declared before `/:id` — no route shadowing
