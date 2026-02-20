# PIXECOM CTO ROADMAP — REVIEW NOTES

> **Source:** `PixEcom_CTO_Roadmap_Q1.docx`
> **Reviewer:** CTO Audit Agent (Claude)
> **Date:** 2026-02-20
> **Cross-referenced with:** audit1-architecture.md, audit2-scale-stress.md, competitor-audit-ads-manager.md, competitor-audit-ad-creation.md

---

## OVERALL ASSESSMENT

Roadmap tổng thể **tốt**, đặc biệt:
- North Star focus đúng (real data trước, không chase features)
- Phase 0 Product Freeze ngăn scope creep
- Excluded features hợp lý (AI Assistant, batch creation, advanced filters → v2)
- CTO Principles solid ("Async jobs for all Meta interactions", "No AI before clean data")

**Tuy nhiên có 8 điểm cần bổ sung/điều chỉnh.**

---

## REVIEW #1: INFRASTRUCTURE PHẢI SỚM HƠN — Phase 0, KHÔNG PHẢI Phase 5

### Roadmap hiện tại:
```
PHASE 5 – INFRASTRUCTURE SCALE (Post-validation)
  Trigger: 10+ active sellers / Large dataset / Performance degradation
  → Migrate Postgres to managed DB
  → Add Redis caching
```

### Vấn đề:
Audit2-scale-stress.md (Section 11, Item #1) đã chỉ rõ:

```
"Separate PostgreSQL to managed service — Must-Fix BEFORE 100 sellers"
"On 4GB VPS, PostgreSQL buffer cache competes with application memory"
"VACUUM operations cause I/O spikes that slow API responses"
```

Với 5–10 internal sellers + stats sync worker chạy mỗi 15 phút (Phase 1), DB sẽ
chịu write pressure ngay lập tức. Worker + API + PostgreSQL + Redis cùng 1 VPS 4GB
→ memory contention sẽ gây crash hoặc data corruption.

### Đề xuất:
```diff
- PHASE 5 – INFRASTRUCTURE SCALE (Post-validation)
-   → Migrate Postgres to managed DB
-   → Add Redis caching

+ PHASE 0 – PRODUCT FREEZE (Week 1)
+   → (existing tasks...)
+   → [NEW] Migrate PostgreSQL to DigitalOcean Managed DB ($15/month)
+   → [NEW] Migrate Redis to Managed Redis ($10/month) or Upstash
+   → [NEW] Set connection_limit=20 in DATABASE_URL
```

| Task | Effort | Cost |
|------|--------|------|
| Migrate PostgreSQL → managed | 2 giờ | $15/tháng |
| Migrate Redis → managed | 1 giờ | $10/tháng |
| Set `connection_limit=20` | 5 phút | $0 |

**Severity: CRITICAL — nếu không fix, Phase 1 stats worker sẽ crash DB**

---

## REVIEW #2: THIẾU CONNECTION POOL CONFIG

### Vấn đề:
Audit2 (Section 10) ghi rõ:

```
Prisma default: 10 connections
Pool exhaustion: starts at 20-30 concurrent requests
Stats sync worker burst writes + API reads = > 10 concurrent connections
```

Stats sync worker (Phase 1) sẽ tạo burst writes mỗi 15 phút. Nếu đúng lúc đó
seller đang dùng Ads Manager → tổng connections > 10 → 503 errors.

### Đề xuất:
Thêm vào Phase 0 hoặc đầu Phase 1:
```
DATABASE_URL="postgresql://...?connection_limit=20"
```

Nếu dùng managed DB thì thêm PgBouncer evaluation (4 giờ, theo audit2 Section 12).

**Severity: CRITICAL — 5 phút effort, ngăn 503 errors**

---

## REVIEW #3: THIẾU TYPE SHARING (Backend ↔ Frontend)

### Vấn đề:
Audit1-architecture.md (Section 2, RF) ghi:

```
"@pixecom/types package is empty"
"Frontend defines its own duplicate types in mock/types.ts"
"Types will inevitably drift"
```

Hiện tại frontend dùng `mock/types.ts` (214 lines, 17 fields) trong khi backend API
trả về DTOs khác hoàn toàn. Khi Phase 2–3 frontend bắt đầu consume real API,
type mismatch → runtime bugs → time wasted debugging.

### Đề xuất:
Thêm vào Phase 0:
```
[NEW] Generate shared DTOs from backend → @pixecom/types package
      - Export response DTOs (CampaignDto, AdsetDto, AdDto, StatsDto)
      - Frontend imports from @pixecom/types instead of mock/types.ts
      - Effort: 1 ngày
```

**Severity: HIGH — nếu không fix ở Phase 0, Phase 2-3 frontend work sẽ bị type drift**

---

## REVIEW #4: THIẾU deliveryStatus FIELD TRONG SCHEMA

### Roadmap hiện tại:
```
PHASE 1: Delivery Status Sync (Every 5 minutes)
  → Sync effective_status and delivery status
```

### Vấn đề:
Roadmap nói sync delivery status nhưng chưa nêu schema change. Từ audit
Ads Manager (Section 8.2E), Selles phân biệt rõ 2 status:

```
┌─────────────────────┬──────────────────────────────────┐
│ Campaign Status     │ User-controlled                  │
│ (Active/Paused/     │ Seller toggle on/off             │
│  Draft)             │                                  │
├─────────────────────┼──────────────────────────────────┤
│ Delivery Status     │ Meta-controlled                  │
│ (Active/Inactive/   │ effective_status from Meta API   │
│  Learning/Error/    │ Cannot be changed by seller      │
│  Limited)           │                                  │
└─────────────────────┴──────────────────────────────────┘
```

Hiện tại PixEcom schema chỉ có 1 field `status` trên Campaign/Adset/Ad.

### Đề xuất:
Thêm vào Phase 1 (trước khi build sync worker):
```prisma
model Campaign {
  status          CampaignStatus    // User-controlled (existing)
  deliveryStatus  DeliveryStatus?   // [NEW] Meta effective_status
  effectiveStatus String?           // [NEW] Raw Meta value
}

enum DeliveryStatus {
  ACTIVE
  INACTIVE
  LEARNING
  ERROR
  LIMITED
  NOT_DELIVERING
}
```

**Severity: HIGH — 0.5 ngày effort, phải làm TRƯỚC khi build sync worker**

---

## REVIEW #5: THIẾU purchaseValue CHO ROAS CALCULATION

### Roadmap hiện tại:
```
PHASE 2: Derived Metrics Engine
  → CPM, CTR, CPC, CPV
  → Cost per ATC, Checkout, Purchase
  → CR, CR1, CR2
```

### Vấn đề:
Danh sách derived metrics **thiếu Purchase Conversion Value** (revenue).
Mà **ROAS = Purchase Value / Spend**.

Từ audit Ads Manager (Section 8.2E), Selles hiển thị:
- **Purchase Conversion Value** (tổng doanh thu từ ads)
- **Results** (optimized conversions, khác với Purchases)
- **Cost per Result** (khác với Cost per Purchase)

Nếu không sync `action_values.omni_purchase` từ Meta → ROAS sẽ luôn = 0.

### Đề xuất:
Thêm vào Phase 1 Stats Sync (không phải Phase 2):
```
AdStatsDaily {
  ...existing fields...
  purchaseValue  Decimal?   // [NEW] action_values.omni_purchase
  results        Int?       // [NEW] optimized conversions
}
```

Và thêm vào Phase 2 Derived Metrics:
```
→ Purchase Conversion Value (sum of purchaseValue)
→ Results (optimized conversion count)
→ Cost per Result (spend / results)
→ ROAS = purchaseValue / spend  // verify formula
```

**Severity: HIGH — không có purchaseValue thì ROAS (feature cốt lõi) = 0**

---

## REVIEW #6: FILTER SYSTEM V1 QUÁ MINIMAL

### Roadmap hiện tại:
```
PHASE 3: Basic Filter System
  → Sellpage filter
  → Campaign status filter
  → Date filter
  = 3 filters total
```

### Vấn đề:
Audit Ads Manager (Section 8.2C) cho thấy Selles có 15 filters. 3 filters cho v1
quá ít — seller thực tế cần phân biệt ad account nào, delivery status nào.

### Đề xuất:
Giữ nguyên 3 filters gốc + thêm 3 filters thiết yếu:

```
V1 FILTERS (6 total):
├── Sellpage filter          ← (existing in roadmap)
├── Campaign status filter   ← (existing in roadmap)
├── Date filter              ← (existing in roadmap)
├── [NEW] Ad Account filter  ← seller có nhiều ad accounts
├── [NEW] Delivery Status    ← phân biệt Meta active vs paused
└── [NEW] Campaign select    ← multi-select cho drill-down

V2 FILTERS (9 more, defer):
├── Media version filter
├── Adtext version filter
├── Thumbnail version filter
├── Ad Post filter
├── Campaign Delivery filter
├── Ad Sets / Status / Delivery (3 filters)
└── Ads / Status / Delivery (3 filters — overlap)
```

**Severity: MEDIUM — 1 ngày effort thêm, UX improvement đáng kể cho seller**

---

## REVIEW #7: THIẾU FRONTEND AUTH WIRING

### Vấn đề:
Roadmap không nhắc đến frontend auth flow. Audit1 ghi rõ:

```
"Frontend is a non-functional UI shell — 100% mock data,
 zero API calls, NO AUTH FLOW, no state management"
```

Timeline trong roadmap:
```
Phase 1 (Weeks 2-4): Backend Meta API + sync → OK, backend only
Phase 2 (Weeks 5-7): Funnel metrics engine    → Backend only? Or frontend too?
Phase 3 (Weeks 8-9): Control layer + filters  → Frontend PHẢI consume real API
```

Nếu đến Phase 3 mà frontend chưa có auth → không thể call bất kỳ API nào
(tất cả endpoints đều behind JwtAuthGuard).

### Đề xuất:
Thêm task vào **cuối Phase 1** hoặc **đầu Phase 2**:

```
[NEW] Frontend Auth Wiring (2-3 ngày)
  1. Login page → POST /api/auth/login → receive JWT
  2. Axios/fetch interceptor → attach Bearer token
  3. Refresh token rotation → auto-renew on 401
  4. Auth context/store (React Context or Zustand)
  5. Protected route wrapper
  6. Delete mock/types.ts, import from @pixecom/types
```

Nếu không làm ở Phase 1-2, toàn bộ Phase 3 frontend work sẽ bị block.

### Proposed timeline adjustment:
```
Phase 1 (Weeks 2-4):
  → Meta API + Stats sync + Delivery sync     ← backend (existing)
  → [NEW] Frontend auth wiring                ← parallel work (2-3 days)

Phase 2 (Weeks 5-7):
  → Funnel metrics + Summary row              ← backend (existing)
  → [NEW] Wire Ads Manager to real API        ← frontend can now call API
```

**Severity: CRITICAL — without auth, NO frontend feature can consume real API**

---

## REVIEW #8: TIMELINE ESTIMATE HƠI AGGRESSIVE CHO PHASE 1

### Roadmap hiện tại:
```
PHASE 1 – META SYNC FOUNDATION (Weeks 2–4) = 3 weeks
  1. Meta API Integration (client + auth + rate limits)
  2. Stats Sync Worker (every 15 min)
  3. Delivery Status Sync (every 5 min)
  4. Basic Ads Manager Endpoint
```

### Vấn đề:
Từ audit ad-creation (Section 10.6) và ads-manager (Section 10), estimate chi tiết:

```
Meta API client (HTTP + auth + rate limiting)     3 days
Stats sync worker (insights → AdStatsDaily)       5 days
Delivery status sync (effective_status)           2 days
Error mapping + retry logic                       2 days  ← NOT in roadmap
Meta sandbox testing with real data               2-3 days ← NOT in roadmap
Basic Ads Manager endpoint                        1 day
───────────────────────────────────────────────────────────
TOTAL                                           15-16 days = ~3.2 weeks (1 dev)
```

3 tuần estimate = 15 dev days, vừa khít nhưng **không có buffer** cho:
- Meta API sandbox approval & testing (cần Business Verification)
- Edge cases (token expiry mid-sync, partial API failures)
- Schema migrations cho deliveryStatus + purchaseValue

### Đề xuất:
```diff
- PHASE 1 (Weeks 2–4) = 3 weeks
+ PHASE 1 (Weeks 2–5) = 4 weeks (3 weeks dev + 1 week buffer/testing)
```

Hoặc nếu muốn giữ 3 tuần → cut "Basic Ads Manager Endpoint" ra Phase 2
(vì Phase 1 focus là sync, Phase 2 mới cần expose data).

**Severity: MEDIUM — better to have realistic timeline than slip**

---

## SUMMARY TABLE

| # | Góp ý | Severity | Effort thêm | Phase nên đặt |
|---|-------|----------|-------------|----------------|
| 1 | Migrate DB/Redis ra managed service | **CRITICAL** | 3 giờ + $25/tháng | Phase 0 |
| 2 | Set `connection_limit=20` | **CRITICAL** | 5 phút | Phase 0 |
| 3 | Fix `@pixecom/types` sharing | **HIGH** | 1 ngày | Phase 0 |
| 4 | Add `deliveryStatus` field to schema | **HIGH** | 0.5 ngày | Phase 1 (trước sync) |
| 5 | Add `purchaseValue` field for ROAS | **HIGH** | 0.5 ngày | Phase 1 (trước sync) |
| 6 | Thêm 3 filters cho v1 (6 total) | **MEDIUM** | 1 ngày | Phase 3 |
| 7 | Frontend auth wiring | **CRITICAL** | 2-3 ngày | Phase 1-2 |
| 8 | Timeline buffer cho Phase 1 | **MEDIUM** | +1 tuần | Phase 1 |
| | **TỔNG EFFORT BỔ SUNG** | | **~7-8 dev days** | |

---

## PROPOSED REVISED PHASE STRUCTURE

```
PHASE 0 – PRODUCT FREEZE + INFRASTRUCTURE (Week 1)
  ├── (existing) Product freeze tasks
  ├── [NEW] Migrate PostgreSQL → managed DB + connection_limit=20
  ├── [NEW] Migrate Redis → managed Redis
  └── [NEW] Generate @pixecom/types from backend DTOs

PHASE 1 – META SYNC FOUNDATION (Weeks 2–5)  ← +1 week buffer
  ├── (existing) Meta API client + rate limits
  ├── (existing) Stats sync worker (15 min)
  ├── (existing) Delivery status sync (5 min)
  ├── [MODIFIED] Add deliveryStatus + purchaseValue to schema FIRST
  ├── [NEW] Meta sandbox testing (2-3 days)
  ├── [NEW] Frontend auth wiring (parallel, 2-3 days)
  └── (existing) Basic Ads Manager endpoint

PHASE 2 – FUNNEL & DECISION LAYER (Weeks 6–8)
  ├── (existing) Extend stats sync (content views, ATC, checkout)
  ├── (existing) Derived metrics engine
  ├── [MODIFIED] Add purchaseValue, Results, Cost per Result to metrics
  ├── (existing) Summary row engine
  ├── (existing) Date presets + timezone
  └── [NEW] Wire frontend Ads Manager to real API

PHASE 3 – CONTROL LAYER (Weeks 9–10)
  ├── (existing) Bulk status update
  ├── (existing) Drill-down views
  └── [MODIFIED] Filter system: 6 filters (not 3)
       ├── Sellpage, Campaign status, Date (existing)
       └── Ad Account, Delivery Status, Campaign select (new)

PHASE 4 – CREATIVE INTELLIGENCE (Optional, unchanged)

PHASE 5 – INFRASTRUCTURE SCALE (Post-validation)
  └── [MODIFIED] Only remaining: read replicas, PgBouncer,
      materialized views, multi-instance
      (basic separation already done in Phase 0)
```

**Total timeline: ~10-11 weeks (vs original 9+ weeks) = +1-2 weeks thêm nhưng
realistic hơn và không technical debt.**

---

*Review by CTO Audit Agent — 2026-02-20*
*Cross-referenced with 4 audit files (255KB total audit data)*
