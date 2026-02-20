# PixEcom v2 — Orders Page Audit (Current State + Gap Analysis)

> **Date:** 2026-02-20
> **Reviewer:** CTO Audit Agent (Claude)
> **Input:** PO feedback + full codebase scan (backend + frontend + schema + E2E tests)
> **Note:** Không có screenshot đối thủ — audit dựa trên current state analysis + PO requirements

---

## 1. CURRENT STATE OVERVIEW

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORDERS FEATURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Backend (apps/api/src/orders/)                                     │
│  ├── 2 endpoints: GET /orders (list) + GET /orders/:id (detail)     │
│  ├── Keyset pagination (createdAt DESC, id DESC)                    │
│  ├── 14 E2E tests — ALL PASSING                                    │
│  └── Tenant isolation via sellerId from JWT ✅                      │
│                                                                     │
│  Prisma Schema (3 models)                                           │
│  ├── Order (24 fields) — includes paymentId, trackingNumber         │
│  ├── OrderItem (11 fields) — denormalized product snapshots         │
│  └── OrderEvent (8 fields) — audit trail with metadata              │
│                                                                     │
│  Frontend (apps/web/src/app/(portal)/orders/page.tsx)               │
│  ├── 100% MOCK DATA (12 orders, 3 detail records)                   │
│  ├── Table: 7 columns (Order, Customer, Sellpage, Status,           │
│  │   Items, Total, Date)                                            │
│  ├── Filters: search + status dropdown                              │
│  ├── Detail: side drawer with items, totals, shipping, timeline     │
│  └── No pagination UI, no date picker, no export                    │
│                                                                     │
│  Status: READ-ONLY — No mutations (update, create, delete)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Order Lifecycle (7 States)

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                                  ↘ CANCELLED
                                  ↘ REFUNDED
```

### 1.3 Current Data Fields

#### Schema (DB) — What's stored:
```
Order
├── id, sellerId, sellpageId, orderNumber
├── customerEmail, customerName, customerPhone
├── shippingAddress (JSONB)
├── subtotal, shippingCost, taxAmount, discountAmount, total, currency
├── status (OrderStatus enum)
├── paymentMethod, paymentId, paidAt           ← In DB but NOT fully exposed
├── trackingNumber, trackingUrl                ← In DB, shown in detail only
├── notes                                      ← In DB but NOT returned by API
└── createdAt, updatedAt
```

#### API Response — What's returned:

**List endpoint** (`GET /api/orders`):
```
OrderListItem
├── id, orderNumber, createdAt
├── sellpage: { id, url } | null
├── customer: { email, name }
├── total, currency
├── status
└── itemsCount
```

**Detail endpoint** (`GET /api/orders/:id`):
```
OrderDetail
├── id, orderNumber, createdAt
├── sellpage: { id, url } | null
├── customer: { email, name, phone }
├── totals: { subtotal, shipping, tax, discount, total, currency }
├── status
├── items[]: { productTitle, variantTitle, qty, unitPrice, lineTotal }
├── events[]: { type, at, note }
├── shippingAddress: { line1, line2, city, state, zip, country }
├── trackingNumber, trackingUrl
└── paymentMethod
```

#### Frontend — What's displayed:

**Table (7 columns):**
| Column | Data | Format |
|--------|------|--------|
| Order | orderNumber | `#ORD-20250213-001` |
| Customer | name + email | Two-line layout |
| Sellpage | URL | Truncated link |
| Status | status | Color-coded badge |
| Items | itemsCount | Centered number |
| Total | total | `$99.90` |
| Date | createdAt | `2d ago` + `Feb 13, 2025` |

**Detail Drawer Sections:**
1. Header: Order # + Status + "Placed {date}"
2. Customer: Name, Email, Phone
3. Items: Product × qty × price → lineTotal
4. Totals: Subtotal, Shipping, Tax, Discount, Total
5. Shipping: Address + Tracking (with external link)
6. Payment: "Paid via {method}"
7. Activity Timeline: Events in reverse chronological order

---

## 2. PO-IDENTIFIED GAPS

### 2.1 ❌ GAP A: Missing Transaction ID (Payment Gateway ID)

**PO Note:** *"thiếu transaction ID (get từ payment gateway)"*

**Analysis:**
- **Schema:** `paymentId` field EXISTS in Order model (`@db.VarChar(255)`)
- **Backend:** `paymentId` is stored but **intentionally excluded** from API response
  - E2E test #14 explicitly verifies: `expect(listItem).not.toHaveProperty('paymentId')`
- **Frontend:** Not displayed anywhere

**Root cause:** Security decision — paymentId was classified as sensitive data and excluded from API response.

**Recommendation:**
```
Option A: Show paymentId as "Transaction ID" in order detail drawer
  → Modify OrderDetail select shape to include paymentId
  → Display in Payment section: "Transaction: pi_3MqJ..."
  → Keep it OUT of list response (only in detail)
  → Effort: 0.5 day

Option B: Show truncated/masked paymentId
  → Show last 8 chars: "...3456789012"
  → Less security concern
  → Effort: 0.5 day
```

**Verdict:** Schema ready ✅ — chỉ cần quyết định hiển thị full hay masked.

---

### 2.2 ❌ GAP B: Tracking Number Not Searchable

**PO Note:** *"Tracking của order hiện không search được trên ô search order"*

**Analysis:**
- **Backend search** hiện chỉ hỗ trợ: `orderNumber` (prefix match) + `customerEmail` (contains, case-insensitive)
- **Frontend mock search** hỗ trợ: orderNumber + email + customerName (client-side)
- **Tracking number:** `trackingNumber` field EXISTS in schema nhưng **không nằm trong search query**

**Fix needed:**

```typescript
// Current (orders.service.ts):
if (search) {
  where.OR = [
    { orderNumber: { startsWith: search } },
    { customerEmail: { contains: search, mode: 'insensitive' } },
  ];
}

// Fixed — add trackingNumber + customerName:
if (search) {
  where.OR = [
    { orderNumber: { startsWith: search, mode: 'insensitive' } },
    { customerEmail: { contains: search, mode: 'insensitive' } },
    { customerName: { contains: search, mode: 'insensitive' } },     // [NEW]
    { trackingNumber: { contains: search, mode: 'insensitive' } },   // [NEW]
  ];
}
```

**Effort:** 0.5 day (backend change + add DB index on trackingNumber)
**Index needed:** `@@index([sellerId, trackingNumber])` on Order model

---

### 2.3 ❌ GAP C: No Export/Import Flow (Critical for Fulfillment)

**PO Note:** *"không có phần xuất và up order để xuất xuống > gửi file cho supplier fulfil > Lấy tracking và điền > Update bulk lại"*

**Analysis:** Đây là workflow **hoàn toàn thiếu** — không có bất kỳ dòng code nào:

```
SELLER FULFILLMENT WORKFLOW (cần implement):

Step 1: EXPORT orders
  ┌──────────────────────────────────┐
  │ Seller chọn orders (checkbox)    │
  │ hoặc filter by status=CONFIRMED │
  │ → Click "Export CSV"             │
  │ → Download file .csv             │
  └──────────────────────────────────┘

  CSV columns cần có:
  ├── OrderNumber
  ├── CustomerName
  ├── CustomerEmail
  ├── CustomerPhone
  ├── ShippingAddress (line1, line2, city, state, zip, country)
  ├── ProductName
  ├── VariantName
  ├── SKU
  ├── Quantity
  └── Notes

Step 2: Supplier FULFILLS + adds tracking

Step 3: IMPORT tracking numbers
  ┌──────────────────────────────────┐
  │ Seller uploads updated CSV       │
  │ CSV columns:                     │
  │ ├── OrderNumber (lookup key)     │
  │ ├── TrackingNumber               │
  │ └── TrackingUrl (optional)       │
  │ → Parse + validate              │
  │ → Preview changes               │
  │ → Confirm update                 │
  └──────────────────────────────────┘

Step 4: BULK UPDATE
  ┌──────────────────────────────────┐
  │ For each row in imported CSV:    │
  │ → Update Order.trackingNumber    │
  │ → Update Order.trackingUrl       │
  │ → Update Order.status = SHIPPED  │
  │ → Create OrderEvent (SHIPPED)    │
  │ → Return success/failure report  │
  └──────────────────────────────────┘
```

**Implementation needed:**

| Component | Type | Effort |
|-----------|------|--------|
| `POST /api/orders/export` endpoint (filtered CSV generation) | Backend | 1 day |
| `POST /api/orders/import-tracking` endpoint (CSV parse + bulk update) | Backend | 2 days |
| `PATCH /api/orders/:id` endpoint (single order update) | Backend | 1 day |
| `PATCH /api/orders/bulk-status` endpoint (bulk status change) | Backend | 1 day |
| Export button + CSV download UI | Frontend | 0.5 day |
| Import modal (file upload + preview + confirm) | Frontend | 1.5 days |
| Bulk select checkbox column | Frontend | 0.5 day |
| **TOTAL** | | **7.5 days** |

---

## 3. ADDITIONAL GAPS (Agent-Identified)

### 3.1 ❌ GAP D: No Order Mutation Endpoints (Write Operations)

Hiện tại Orders là **100% read-only** — không có endpoint nào cho:

| Action | Endpoint | Status |
|--------|----------|--------|
| Update order status | `PATCH /api/orders/:id/status` | ❌ MISSING |
| Update tracking info | `PATCH /api/orders/:id/tracking` | ❌ MISSING |
| Add note to order | `POST /api/orders/:id/notes` | ❌ MISSING |
| Cancel order | `PATCH /api/orders/:id/cancel` | ❌ MISSING |
| Refund order | `PATCH /api/orders/:id/refund` | ❌ MISSING |
| Bulk status update | `PATCH /api/orders/bulk-status` | ❌ MISSING |
| Bulk tracking update | `PATCH /api/orders/bulk-tracking` | ❌ MISSING |

**Impact:** Seller phải vào từng payment gateway (Stripe dashboard) để manage orders — không thể quản lý trong PixEcom.

**Effort:** 3-4 days for core mutations (status + tracking + notes + cancel)

---

### 3.2 ❌ GAP E: No Date Range Picker UI

- Backend supports `dateFrom` / `dateTo` query params ✅
- Frontend: **NO date picker component** — default date range = today (backend default)
- Mock data bypasses this entirely

**Impact:** Seller chỉ thấy orders của ngày hôm nay khi connect real API.

**Effort:** 0.5 day (reuse DateRangePicker component from Ads Manager — Task 2.4 in TECH-SPEC)

---

### 3.3 ❌ GAP F: No Pagination UI

- Backend keyset pagination: fully implemented ✅
- Frontend: **NO pagination controls** — all 12 mock orders render at once
- No "Load more" button, no page indicator

**Impact:** Nếu seller có 500+ orders → page sẽ freeze hoặc chỉ show 20 đầu tiên.

**Effort:** 0.5 day (load more button + cursor state)

---

### 3.4 ⚠️ GAP G: `notes` Field Not Exposed in API

- Schema: `notes String?` EXISTS on Order model
- Service: **NOT included** in OrderDetail select shape
- Frontend: Cannot display notes

**Impact:** Seller notes (internal memo) bị mất — không nhìn thấy dù đã lưu trong DB.

**Effort:** 0.25 day (add to select shape + display in drawer)

---

### 3.5 ⚠️ GAP H: `shippingAddress` Inconsistency

- E2E test #14 explicitly asserts `shippingAddress` should NOT appear in response
- BUT OrderDetail interface includes `shippingAddress` and frontend drawer displays it
- Mock data includes full address

**Impact:** Khi wire real API, address section sẽ biến mất vì backend không trả về.

**Fix:** Decide — keep address in detail response (update test) or remove from frontend.

**Effort:** 0.25 day

---

### 3.6 ⚠️ GAP I: Search Backend vs Frontend Mismatch

| Search field | Backend | Frontend (mock) |
|---|---|---|
| Order number | ✅ prefix match | ✅ includes match |
| Customer email | ✅ contains | ✅ contains |
| Customer name | ❌ NOT SUPPORTED | ✅ includes match |
| Tracking number | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED |

**Impact:** Khi wire real API, search by customer name sẽ ngừng hoạt động.

**Fix:** Add `customerName` + `trackingNumber` to backend search (Gap B covers this).

---

### 3.7 ⚠️ GAP J: No Order Count / Revenue KPIs

Frontend hiện tính summary stats từ mock data:
```
counts: { all, pending, processing, shipped, delivered }
totalRevenue: sum of all order totals
```

Nhưng khi wire real API, cần backend endpoint cho aggregate stats:
- Total orders count (by status)
- Total revenue
- Average order value
- Orders today/this week/this month

**Effort:** 1 day (backend aggregate endpoint + frontend KPI cards)

---

### 3.8 ❌ GAP K: No Sellpage Filter Dropdown

- Backend: `sellpageId` filter EXISTS ✅
- Frontend: **NO sellpage dropdown** — only search + status filter visible

**Impact:** Seller có nhiều sellpages → không thể filter orders by sellpage.

**Effort:** 0.25 day (add Select dropdown, data from GET /api/sellpages)

---

### 3.9 ⚠️ GAP L: No Sort Options

- Backend: Fixed sort by `createdAt DESC`
- Frontend: No sort controls on any column

**Impact:** Seller không thể sort by total, status, date ASC, etc.

**Effort:** 1 day (backend multi-field sort + frontend column headers with sort arrows)

---

## 4. GAP SCORE CARD

| # | Category | Current Score | Target Score | Priority | Effort |
|---|----------|:------------:|:------------:|----------|--------|
| A | Transaction ID (paymentId) | 0/10 | 8/10 | **P1 — PO requested** | 0.5 day |
| B | Tracking searchable | 0/10 | 9/10 | **P1 — PO requested** | 0.5 day |
| C | Export/Import/Bulk flow | 0/10 | 9/10 | **P0 — PO requested, CRITICAL** | 7.5 days |
| D | Order mutations (status, tracking, notes) | 0/10 | 8/10 | **P1** | 3-4 days |
| E | Date range picker | 0/10 | 9/10 | **P1** | 0.5 day |
| F | Pagination UI | 0/10 | 8/10 | **P1** | 0.5 day |
| G | Notes field exposed | 0/10 | 7/10 | P2 | 0.25 day |
| H | shippingAddress consistency | 5/10 | 9/10 | P2 | 0.25 day |
| I | Search fields complete | 5/10 | 9/10 | P1 (linked to B) | 0 (done in B) |
| J | Order KPIs/Aggregates | 3/10 | 8/10 | P2 | 1 day |
| K | Sellpage filter dropdown | 0/10 | 8/10 | P2 | 0.25 day |
| L | Sort options | 0/10 | 7/10 | P3 | 1 day |
| | **OVERALL** | **1.5/10** | **8.5/10** | | **~15 days** |

---

## 5. PRIORITY MATRIX

### P0 — Must Have (PO Requested, Critical)

| # | Feature | Effort | Reason |
|---|---------|--------|--------|
| C | Export/Import/Bulk Tracking Flow | 7.5 days | Core fulfillment workflow — without this, seller cannot operate |

### P1 — Must Have (Launch Blocker)

| # | Feature | Effort | Reason |
|---|---------|--------|--------|
| A | Transaction ID display | 0.5 day | PO requested — seller needs payment reference |
| B | Tracking searchable | 0.5 day | PO requested — cannot find shipped orders |
| D | Order mutations | 3-4 days | Cannot manage orders without write operations |
| E | Date range picker | 0.5 day | Default = today means no historical orders visible |
| F | Pagination UI | 0.5 day | Page breaks with 20+ orders |

### P2 — Should Have (UX Quality)

| # | Feature | Effort | Reason |
|---|---------|--------|--------|
| G | Notes field | 0.25 day | Seller notes exist in DB but invisible |
| H | Address fix | 0.25 day | Test vs implementation inconsistency |
| J | Order KPIs | 1 day | Revenue visibility |
| K | Sellpage filter | 0.25 day | Multi-sellpage sellers need this |

### P3 — Nice to Have

| # | Feature | Effort | Reason |
|---|---------|--------|--------|
| L | Column sorting | 1 day | UX convenience |

---

## 6. IMPLEMENTATION ROADMAP

### Phase A: Quick Wins (2 days)

```
A1. Add paymentId to OrderDetail response              → 0.25 day
A2. Add trackingNumber + customerName to search         → 0.5 day
A3. Add notes to OrderDetail response                   → 0.25 day
A4. Fix shippingAddress test/response consistency       → 0.25 day
A5. Add sellpage filter dropdown to frontend            → 0.25 day
A6. Add date range picker (reuse from Ads Manager)      → 0.25 day
A7. Add pagination "Load more" button                   → 0.25 day
```

### Phase B: Core Mutations (3-4 days)

```
B1. PATCH /api/orders/:id — update status + tracking    → 1 day
B2. POST /api/orders/:id/notes — add note + event       → 0.5 day
B3. PATCH /api/orders/:id/cancel — cancel with reason   → 0.5 day
B4. PATCH /api/orders/bulk-status — batch status change  → 1 day
B5. Frontend: action buttons in detail drawer            → 0.5 day
B6. Frontend: checkbox column + bulk action bar          → 0.5 day
```

### Phase C: Export/Import Flow (7.5 days) — P0 PO PRIORITY

```
C1. POST /api/orders/export — CSV generation endpoint   → 1 day
    - Accept filters (status, dateRange, sellpageId)
    - Generate CSV with columns:
      OrderNumber, CustomerName, CustomerEmail, CustomerPhone,
      AddressLine1, AddressLine2, City, State, Zip, Country,
      ProductName, VariantName, SKU, Quantity, Notes

C2. POST /api/orders/import-tracking — CSV parse         → 2 days
    - Accept CSV upload (multipart/form-data)
    - Parse and validate:
      ├── OrderNumber (required, must exist + belong to seller)
      ├── TrackingNumber (required)
      └── TrackingUrl (optional, auto-generate if carrier known)
    - Return preview: { matched, unmatched, errors }
    - On confirm: bulk update + create SHIPPED events

C3. PATCH /api/orders/bulk-tracking — bulk update         → 1 day
    - Accept: [{ orderNumber, trackingNumber, trackingUrl? }]
    - For each: update tracking + set status=SHIPPED + create event
    - Return: { succeeded, failed }

C4. Frontend: Export button + filters                     → 0.5 day
    - "Export CSV" button in page header
    - Respects current filter state

C5. Frontend: Import modal (upload + preview + confirm)   → 1.5 days
    - Step 1: File upload zone (drag & drop .csv)
    - Step 2: Preview table (matched/unmatched/errors)
    - Step 3: Confirm button → call API → show results
    - Step 4: Success report toast

C6. Frontend: Bulk selection + bulk action dropdown       → 0.5 day
    - Checkbox column
    - "Bulk Update" dropdown: Change Status, Export Selected

C7. Integration testing + edge cases                      → 1 day
    - Large CSV (1000+ rows)
    - Duplicate tracking numbers
    - Orders from other sellers (security)
    - Malformed CSV handling
```

### Phase D: Polish (2 days)

```
D1. Order KPI cards (revenue, count, AOV)                → 1 day
D2. Column sorting (backend + frontend)                   → 1 day
```

---

## 7. EXPORT CSV FORMAT SPECIFICATION

### Export (Download)

```csv
OrderNumber,CustomerName,CustomerEmail,CustomerPhone,AddressLine1,AddressLine2,City,State,Zip,Country,ProductName,VariantName,SKU,Quantity,TrackingNumber,TrackingUrl,Status,Notes
ORD-20250213-001,Sarah Johnson,sarah.j@gmail.com,+1 (555) 234-5678,123 Oak Street,Apt 4B,Austin,TX,78701,US,SlimFit Detox Tea - 30 Day Supply,,SFD-30,2,,,CONFIRMED,
ORD-20250213-002,Mike Chen,mike.c@yahoo.com,+1 (555) 345-6789,456 Elm Ave,,Denver,CO,80202,US,GlowUp Vitamin C Serum,30ml,GUV-30ML,1,,,CONFIRMED,
```

**Rules:**
- 1 row per OrderItem (order with 3 items = 3 rows)
- Shared order fields repeated per row
- TrackingNumber/TrackingUrl columns empty for unfulfilled orders
- UTF-8 encoding with BOM for Excel compatibility

### Import (Upload)

```csv
OrderNumber,TrackingNumber,TrackingUrl
ORD-20250213-001,9400111899223456789012,https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789012
ORD-20250213-002,1Z999AA10123456784,https://www.ups.com/track?tracknum=1Z999AA10123456784
```

**Minimum required columns:** OrderNumber + TrackingNumber
**Optional columns:** TrackingUrl (auto-detect carrier if omitted)
**Auto-detection logic:**
- Starts with `1Z` → UPS → `https://www.ups.com/track?tracknum=`
- 20-22 digits → USPS → `https://tools.usps.com/go/TrackConfirmAction?tLabels=`
- 12-15 digits → FedEx → `https://www.fedex.com/fedextrack/?trknbr=`

---

## 8. SCHEMA CHANGES NEEDED

```prisma
// ─── ADD INDEX for tracking search ──────────────────────────────────────────
model Order {
  // ... existing fields ...

  @@index([sellerId, trackingNumber])    // [NEW] for tracking search
  @@index([sellerId, customerName])      // [NEW] for name search
  // existing: @@index([sellerId, status])
  // existing: @@index([sellerId, sellpageId])
  // existing: @@index([sellerId, createdAt])
}
```

---

## 9. CONCLUSION

### Answering PO's Question:

**1. Transaction ID (paymentId):** Schema có sẵn → chỉ cần expose trong API response (0.5 day)

**2. Tracking search:** Backend search thiếu trackingNumber + customerName → fix đơn giản (0.5 day)

**3. Export/Import/Bulk flow:** **HOÀN TOÀN THIẾU** — đây là feature lớn nhất cần build (7.5 days). Workflow: Export CSV → gửi supplier → nhận tracking → Import CSV → bulk update.

### Agent-Identified Additional Gaps:

**Critical (P1):** Order mutations (update status, tracking, notes) — 3-4 days. Không có write endpoints = seller không quản lý được orders.

**Important (P1):** Date range picker + Pagination UI — 1 day tổng. Không có = chỉ thấy orders hôm nay, page freeze khi nhiều data.

**Quality (P2):** Notes field, address fix, sellpage filter, KPIs — 1.75 days.

### Overall Score: **1.5/10** (gap rất lớn cho một eCommerce platform)

### Total Effort to Close All Gaps: **~15 dev days**

---

*Audit by CTO Audit Agent — 2026-02-20*
*Cross-referenced with: orders.service.ts, orders.controller.ts, orders.e2e-spec.ts, schema.prisma, page.tsx, mock/orders.ts*
