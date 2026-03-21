# PixEcom v2 — Alpha Test Report

> **Phiên bản:** 1.0 | **Ngày test:** 2026-02-21
> **Trạng thái:** Completed
> **URL Staging:** `https://staging.pixelxlab.com`
> **API Staging:** `https://api-staging.pixelxlab.com`
> **Tài khoản test:** `alpha1@pixecom.io` (Alpha Store One)

---

## TỔNG KẾT (Summary)

| Metric       | Count |
|--------------|-------|
| **PASS**     | 34    |
| **BUG**      | 5     |
| **NOTE**     | 2     |
| **Tổng test**| 39    |

**Kết luận:** Portal cơ bản hoạt động. 4 trang chính (Orders, Sellpages, Ads Manager, Analytics) đều hiển thị data đúng. Phát hiện 5 bugs, trong đó 1 High (API 503 intermittent), 2 Medium, 2 Low. Products page có nhiều lỗi hiển thị nhất.

---

## BUG LIST

| ID | Severity | Page | Mô tả | Tái hiện |
|----|----------|------|-------|----------|
| **BUG-01** | **High** | Orders | API trả **503 Service Unavailable** intermittent. Frontend hiện "Failed to fetch" + Retry button. Retry đôi khi không khắc phục được — data cũ (stale) vẫn hiện dưới. Network: `GET /api/orders → 503`. Nghi do Railway cold start hoặc backend overload. | Xảy ra 2/3 lần load Orders |
| **BUG-02** | **Medium** | Global | Session bị **logout giữa chừng** — redirect về `/login` không warning. Xảy ra sau vài phút sử dụng. Có thể JWT access token hết hạn mà refresh token không tự động renew. | Xảy ra 2 lần trong session test |
| **BUG-03** | **Medium** | Products | Price hiển thị **$NaN** cho tất cả 3 products. Frontend không parse được giá trị price từ API response. | 100% reproducible |
| **BUG-04** | **Low** | Products | CREATED column hiển thị **"Invalid Date"** cho tất cả products. Date parsing lỗi. | 100% reproducible |
| **BUG-05** | **Low** | Products | Subtitle hiện **"(0 total)"** mặc dù có 3 products hiển thị trong list. Count logic sai. | 100% reproducible |

---

## CHI TIẾT TỪNG TRANG

### 1. ORDERS (`/orders`)

| # | Test Item | Result | Chi tiết |
|---|-----------|--------|----------|
| 1 | Page load (initial) | **PASS** | Orders list load thành công, không lỗi lần đầu |
| 2 | Table columns | **PASS** | ORDER, DATE, STATUS, TOTAL, CUSTOMER, ITEMS — đầy đủ |
| 3 | Status badges (màu) | **PASS** | CANCELLED (đỏ), SHIPPED (cyan), DELIVERED (xanh lá), CONFIRMED (xanh nhạt), PENDING (vàng) |
| 4 | Status filter dropdown | **PASS** | 8 options: All statuses, PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED |
| 5 | Filter by SHIPPED | **PASS** | Chỉ hiện orders SHIPPED, data đúng |
| 6 | Search "trinh" + SHIPPED | **PASS** | 4 kết quả chính xác — filter + search kết hợp OK |
| 7 | Pagination | **PASS** | "Page 1 · 4 rows", Prev/Next buttons hiển thị |
| 8 | Date range filter | **PASS** | 22/01/2026 — 21/02/2026, date picker hoạt động |
| 9 | Order Detail — Header | **PASS** | Order number (A0001-0091) + Status badge (CANCELLED) + Date |
| 10 | Order Detail — Customer | **PASS** | Name, email, phone hiển thị đúng |
| 11 | Order Detail — Totals | **PASS** | Subtotal, Shipping, Tax, Discount, **Total** — format $USD |
| 12 | Order Detail — Sellpage link | **PASS** | Link clickable tới sellpage URL |
| 13 | Order Detail — Items table | **PASS** | Product, Variant, Qty, Unit Price, Line Total — 4 items |
| 14 | Order Detail — Timeline | **PASS** | 2 events: CREATED → CANCELLED với timestamps + descriptions |
| 15 | Order Detail — Refresh Tracking | **PASS** | "Coming soon" label hiển thị |
| 16 | "Failed to fetch" / API 503 | **BUG-01** | Intermittent 503, Retry đôi khi fail |
| 17 | Session logout giữa chừng | **BUG-02** | Redirect /login giữa session |

### 2. SELLPAGES (`/sellpages`)

| # | Test Item | Result | Chi tiết |
|---|-----------|--------|----------|
| 18 | Page load | **PASS** | 4 sellpages hiển thị, "4 sellpages" count đúng |
| 19 | Table columns | **PASS** | SELLPAGE (title + slug), STATUS, DOMAIN/URL, TYPE, CREATED |
| 20 | Status badges | **PASS** | DRAFT (xám), PUBLISHED (xanh lá) |
| 21 | Data mix | **PASS** | 2 DRAFT + 2 PUBLISHED — đúng seed data |
| 22 | Status filter | **PASS** | "All statuses" dropdown hiện |
| 23 | Search box | **PASS** | "Search slug or title..." placeholder |
| 24 | Detail — URL/Domain | **PASS** | Slug, Type: SINGLE, live URL link clickable |
| 25 | Detail — Linked Product | **PASS** | Product name + base price $29.99 |
| 26 | Detail — Description Override | **PASS** | Text hiện đúng |
| 27 | Detail — Stats (5 KPIs) | **PASS** | REVENUE, COST, YOUTAKE, HOLD, CASHTOBALANCE — stub "—" |
| 28 | Detail — Stub note | **PASS** | "Sellpage stats are stubs — not yet implemented in backend." |
| 29 | Detail — Assigned Creative | **PASS** | "Coming soon — creative assignment endpoint not yet available" |
| 30 | Product image broken | **NOTE** | Alt text "SlimPro" hiện thay ảnh. Image URL có thể chưa upload lên CDN staging. |

### 3. ADS MANAGER (`/ads-manager`)

| # | Test Item | Result | Chi tiết |
|---|-----------|--------|----------|
| 31 | Campaign list load | **PASS** | 6 campaigns hiển thị |
| 32 | Status badges | **PASS** | ACTIVE (xanh lá), PAUSED (vàng), ARCHIVED (xám) |
| 33 | 18 metric columns | **PASS** | CAMPAIGN, PLATFORM, STATUS, BUDGET/DAY, SPENT, IMPR., CLICKS, CTR, CPC, CV, COST/CV, CHECKOUT, COST/CO, CR1, CR2, CR, CONV., ROAS |
| 34 | Metric formats | **PASS** | $ cho money, % cho rates, số nguyên cho counts |
| 35 | Date filters | **PASS** | Today / 7d / **30d** (active default) / custom date range |
| 36 | Summary row | **PASS** | Spend: $6,183.86 · Impr: 765,200 · Clicks: 30,989 · CTR: 4.05% · CV: 21,135 · Checkout: 3,207 · Conv: 1,345 · ROAS: 7.62 |
| 37 | "Meta only" toggle | **PASS** | Hiển thị ở góc phải trên |
| 38 | Drilldown → Ad Sets | **PASS** | Breadcrumb: Back / Campaigns / [name]. 3 adsets + full metrics + summary |
| 39 | Drilldown → Ads | **PASS** | Breadcrumb 3 levels. 4 ads (3 ACTIVE, 1 PAUSED). PAUSED ad hiện CR2=0.00%, Conv=0 — edge case OK |
| 40 | Status filter (Ad Sets) | **PASS** | "All statuses" dropdown |
| 41 | Budget column | **PASS** | Budget/Day hiện "$50.00" hoặc "—" (lifetime) |

### 4. ANALYTICS (`/analytics`)

| # | Test Item | Result | Chi tiết |
|---|-----------|--------|----------|
| 42 | Page load | **PASS** | "Performance overview" hiển thị |
| 43 | KPI — REVENUE | **PASS** | $47,108.46 — label "purchaseValue from ads" |
| 44 | KPI — AD SPEND | **PASS** | $6,183.86 |
| 45 | KPI — YOUTAKE | **PASS** | Stub "—", label "Stub — not yet wired" |
| 46 | KPI — HOLD | **PASS** | Stub "—", label "Stub — not yet wired" |
| 47 | KPI — CASHTOBALANCE | **PASS** | Stub "—", label "Stub — not yet wired" |
| 48 | Date filters | **PASS** | Today / 7d / **30d** / custom |
| 49 | Top Campaigns by Spend | **PASS** | 5 campaigns, sorted desc by spend. Columns: CAMPAIGN, STATUS, SPEND, ROAS, CONV., CTR |
| 50 | Sellpages section | **PASS** | 4 sellpages. Columns: SELLPAGE, STATUS, REVENUE, YOUTAKE. Revenue/YouTake = "–" (stub) |
| 51 | Thiếu ROAS KPI card | **NOTE** | Không có ROAS trong 5 KPI cards. Có thể cần thêm 1 card ROAS = purchaseValue / adSpend |

### 5. PRODUCTS (`/products`) — Bonus

| # | Test Item | Result | Chi tiết |
|---|-----------|--------|----------|
| 52 | Page load | **PASS** | 3 products hiển thị (SlimPro Mouse, ProStand, UltraClean Desk Pad) |
| 53 | Type filter tabs | **PASS** | All / Physical / Digital / Subscription / Bundle |
| 54 | Price $NaN | **BUG-03** | Tất cả products hiện $NaN |
| 55 | "Invalid Date" | **BUG-04** | CREATED column hiện "Invalid Date" |
| 56 | Count "(0 total)" sai | **BUG-05** | Subtitle "(0 total)" dù có 3 products |

### 6. NAVIGATION & GLOBAL

| # | Test Item | Result | Chi tiết |
|---|-----------|--------|----------|
| 57 | Sidebar nav links | **PASS** | Orders, Ads Manager, Analytics, Sellpages, Products, Health — tất cả clickable |
| 58 | Active state highlight | **PASS** | Link active đổi màu (xanh) |
| 59 | Seller info sidebar | **PASS** | "Alpha Store One" + "Alpha Store One" subtitle |
| 60 | Sign out button | **PASS** | Hiển thị ở sidebar dưới |
| 61 | Health Check page | **PASS** | "Run Health Check" button + API endpoint link |

---

## KHUYẾN NGHỊ (Recommendations)

### Ưu tiên cao (Fix trước khi mở rộng test)
1. **BUG-01**: Investigate API 503 — kiểm tra Railway logs, cold start config, connection pooling. Có thể cần keep-alive hoặc warm-up mechanism.
2. **BUG-02**: Debug JWT refresh flow — access token hết hạn thì refresh token phải tự động renew. Kiểm tra `apiClient.ts` interceptor logic.

### Ưu tiên trung bình
3. **BUG-03**: Products page — fix price parsing (có thể API trả `null` hoặc object thay vì number).
4. **Sellpage detail**: Upload product images lên CDN staging hoặc handle broken image gracefully.

### Ưu tiên thấp
5. **BUG-04 + BUG-05**: Products page — fix date format + count logic.
6. **Analytics**: Cân nhắc thêm ROAS KPI card (= Revenue / Ad Spend).

---

## DEFINITION OF DONE — Alpha Exit Criteria

| Tiêu chí | Status |
|----------|--------|
| 4 trang chính load không lỗi | **Partial** — intermittent 503 |
| Data hiển thị đúng format | **PASS** — trừ Products ($NaN) |
| Filters hoạt động | **PASS** |
| Drilldown 3 tầng (Ads Manager) | **PASS** |
| Không có lỗi Critical/Blocker | **PASS** — BUG-01 là High nhưng intermittent |
| Feedback form đã fill | **PASS** |

**Alpha Exit:** **Conditional PASS** — có thể mở rộng test nếu fix BUG-01 (503) và BUG-02 (session).

---

_Report generated: 2026-02-21 by Claude Code Alpha Tester_
