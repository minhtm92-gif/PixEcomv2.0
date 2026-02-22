# PixEcom v2 — Alpha Test Plan (Internal)

> **Phiên bản:** 1.0 | **Ngày tạo:** 2026-02-21
> **Trạng thái:** Frontend Integration Preview
> **URL Preview:** _(điền link staging)_
> **Tài khoản test:** _(điền email/password demo)_

---

## 1. KẾ HOẠCH TEST 3 NGÀY (3-Day Alpha Plan)

### Ngày 1 — Đăng nhập + Orders + Sellpages

| Thời gian | Ai test | Việc cần làm |
|-----------|---------|--------------|
| Sáng | Seller A | Đăng nhập → vào `/orders` → lọc theo ngày, status, search → mở chi tiết 1 đơn |
| Sáng | Staff QA | Đăng nhập → vào `/sellpages` → xem danh sách → mở chi tiết 1 sellpage |
| Chiều | Cả 2 | Ghi feedback vào form (mục 3). Ghi lại mọi lỗi 400/401/403/500 kèm `requestId` |

### Ngày 2 — Ads Manager (3 tầng drilldown)

| Thời gian | Ai test | Việc cần làm |
|-----------|---------|--------------|
| Sáng | Seller A | `/ads-manager` → xem Campaign list → click vào 1 Campaign → Adset → Ad |
| Sáng | Staff QA | Đổi date filter (Today / 7d / 30d / Custom) → kiểm tra số liệu có thay đổi |
| Chiều | Cả 2 | Kiểm tra các cột hiển thị (spend, impressions, clicks, CPC, CPM, CTR, CR, ROAS…) |

### Ngày 3 — Analytics + Tổng hợp feedback

| Thời gian | Ai test | Việc cần làm |
|-----------|---------|--------------|
| Sáng | Seller A | `/analytics` → kiểm tra KPI cards (Revenue, Ad Spend, ROAS, YouTake, Hold, CashToBalance) |
| Sáng | Staff QA | Cross-check: so sánh số liệu Analytics vs Ads Manager → ghi sai lệch nếu có |
| Chiều | Cả 2 | Review toàn bộ feedback → phân loại Blocker/Major/Minor → họp 15 phút tổng kết |

---

## 2. CHECKLIST THEO TRANG (Page Checklists)

### 2.1 Orders (`/orders` + `/orders/[id]`)

- [ ] Danh sách đơn hàng load đúng (có phân trang cursor)
- [ ] Lọc theo ngày (`dateFrom` / `dateTo`) hoạt động
- [ ] Lọc theo trạng thái (status filter) hoạt động
- [ ] Tìm kiếm theo mã đơn hoặc email khách hoạt động
- [ ] Click vào đơn → trang chi tiết hiện đúng thông tin:
  - [ ] Thông tin khách (customer name, email, phone)
  - [ ] Danh sách sản phẩm (line items) + số lượng + giá
  - [ ] Tổng tiền (subtotal, shipping, tax, total)
  - [ ] Lịch sử sự kiện (event history / status timeline)
- [ ] **Không hiển thị** các trường nội bộ (`sellerId`, `paymentMethod`, `trackingNumber`, `notes`)
- [ ] Lỗi 4xx/5xx có hiện thông báo rõ ràng (không blank screen)
- [ ] `requestId` hiển thị được khi có lỗi

**Thiếu / Chưa có (Known gaps):**
- [ ] Refresh tracking (chưa wire)
- [ ] `transactionId` (chưa hiển thị trên UI)

---

### 2.2 Ads Manager (`/ads-manager`)

- [ ] Campaign list load đúng
- [ ] Click Campaign → Adset list load đúng
- [ ] Click Adset → Ad list load đúng
- [ ] Breadcrumb navigation hoạt động (Campaign > Adset > Ad)
- [ ] Date filter hoạt động: Today / 7d / 30d / Custom range
- [ ] Status filter hoạt động
- [ ] Các cột metrics hiển thị đúng:
  - [ ] Spend
  - [ ] Impressions
  - [ ] Clicks
  - [ ] CPC (Cost Per Click)
  - [ ] CPM (Cost Per Mille)
  - [ ] CTR (Click-Through Rate)
  - [ ] CR / CR1 / CR2 — xác nhận định nghĩa có đúng không
  - [ ] ROAS (Return On Ad Spend) — xác nhận công thức
- [ ] Số liệu thay đổi khi đổi date range
- [ ] Lỗi 4xx/5xx có hiện thông báo rõ ràng
- [ ] `requestId` hiển thị được khi có lỗi

**Thiếu / Chưa có (Known gaps):**
- [ ] Column sorting
- [ ] Export CSV/Excel
- [ ] Bulk actions

---

### 2.3 Analytics (`/analytics`)

- [ ] Trang load không lỗi
- [ ] KPI cards hiển thị đúng giá trị:
  - [ ] Revenue
  - [ ] Ad Spend
  - [ ] ROAS — **ghi lại công thức UI đang dùng**
  - [ ] YouTake — **ghi lại công thức UI đang dùng**
  - [ ] Hold
  - [ ] CashToBalance
- [ ] Date range filter hoạt động (nếu có)
- [ ] Số liệu khớp logic với Ads Manager (cross-check)
- [ ] **Ghi rõ:** metrics nào đang là stub/giả (nếu thấy số = 0 hoặc N/A)
- [ ] Lỗi 4xx/5xx có hiện thông báo rõ ràng
- [ ] `requestId` hiển thị được khi có lỗi

**Định nghĩa cần xác nhận (Metric Definitions):**

| Metric | Định nghĩa mong đợi | UI hiện tại đúng? |
|--------|---------------------|-------------------|
| CR (Conversion Rate) | Orders / Clicks × 100 | ☐ Đúng ☐ Sai ☐ Không rõ |
| CR1 | AddToCart / Clicks × 100 | ☐ Đúng ☐ Sai ☐ Không rõ |
| CR2 | Orders / AddToCart × 100 | ☐ Đúng ☐ Sai ☐ Không rõ |
| ROAS | Revenue / Ad Spend | ☐ Đúng ☐ Sai ☐ Không rõ |

---

### 2.4 Sellpages (`/sellpages` + `/sellpages/[id]`)

- [ ] Danh sách sellpages load đúng
- [ ] Lọc theo status (DRAFT / PUBLISHED / ARCHIVED) hoạt động
- [ ] Tìm kiếm theo tên hoạt động
- [ ] Click vào sellpage → chi tiết hiện đúng:
  - [ ] Tên, slug, domain
  - [ ] Product snapshot (sản phẩm gắn với sellpage)
  - [ ] Trạng thái (Draft/Published)
- [ ] Lỗi 4xx/5xx có hiện thông báo rõ ràng
- [ ] `requestId` hiển thị được khi có lỗi

---

## 3. FORM BÁO LỖI / FEEDBACK (Bug Report Template)

> Copy/paste phần dưới vào Notion database hoặc Google Form.

### Các trường (Fields):

**1. Mức độ (Severity)** — Dropdown
- `Blocker` — Không dùng được, chặn flow chính
- `Major` — Sai logic / thiếu data quan trọng, nhưng vẫn dùng được
- `Minor` — UI lệch, thiếu label, vấn đề nhỏ

**2. Trang / Module (Page)** — Dropdown
- Orders
- Orders Detail
- Ads Manager — Campaign
- Ads Manager — Adset
- Ads Manager — Ad
- Analytics
- Sellpages
- Sellpage Detail
- Login
- Khác (Other)

**3. Tiêu đề ngắn (Short Title)** — Text
_Ví dụ: "Cột ROAS hiện 0 khi có data"_

**4. Các bước tái hiện (Steps to Reproduce)** — Long Text
```
1. Đăng nhập bằng tài khoản ...
2. Vào trang /ads-manager
3. Click campaign "ABC"
4. Xem cột ROAS
```

**5. Kết quả mong đợi (Expected)** — Text
_Ví dụ: "ROAS = Revenue / Spend = 2.5"_

**6. Kết quả thực tế (Actual)** — Text
_Ví dụ: "ROAS hiển thị 0.00"_

**7. Screenshot / Video** — URL
_Paste link Google Drive / Imgur / Loom_

**8. Request ID** — Text
_⚠️ BẮT BUỘC khi gặp lỗi. Tìm trong:_
- _Toast/error message trên UI_
- _DevTools → Network tab → Response headers → `x-request-id`_
- _Console log (nếu có)_

**9. HTTP Status Code** — Text
_Ví dụ: 400, 401, 403, 500. Xem trong DevTools → Network tab._

**10. Ngày test (Date)** — Date

**11. Người test (Tester)** — Text

---

## 4. YÊU CẦU BỔ SUNG (Missing Item Requests)

> Dùng bảng này để đề xuất thêm trường/cột/tính năng mới chưa có trên UI.

### Template:

| # | Trang (Page) | Mô tả yêu cầu (Description) | Lý do cần (Why) | Ưu tiên (Priority) | Người đề xuất |
|---|-------------|------------------------------|------------------|--------------------:|---------------|
| 1 | _Ví dụ: Ads Manager_ | _Thêm cột "Cost Per Order"_ | _Cần để tính hiệu quả quảng cáo_ | High / Medium / Low | _Tên_ |
| 2 | | | | | |
| 3 | | | | | |

**Hướng dẫn:**
- Ghi rõ trang nào, vị trí nào muốn thêm
- Nếu là metric mới → ghi rõ công thức tính
- Nếu là filter mới → ghi rõ giá trị filter

---

## 5. DEFINITION OF DONE — TIÊU CHÍ THOÁT ALPHA (Alpha Exit Criteria)

Alpha được coi là **PASS** khi đạt TẤT CẢ các điều kiện sau:

### Bắt buộc (Must Have)

- [ ] **Zero Blocker** — Không còn bug Blocker nào mở
- [ ] **Login hoạt động** — Đăng nhập/đăng xuất ổn định, token refresh không lỗi
- [ ] **4 trang core load được** — Orders, Ads Manager, Analytics, Sellpages đều render không crash
- [ ] **Tenant isolation xác nhận** — Seller A không thấy data Seller B (test với 2 tài khoản)
- [ ] **Số liệu nhất quán** — Metrics trên Analytics khớp logic với Ads Manager (±5% chấp nhận do rounding)
- [ ] **Error handling cơ bản** — Lỗi 4xx/5xx hiện thông báo có `requestId`, không blank screen
- [ ] **Metric definitions thống nhất** — CR/CR1/CR2/ROAS đã xác nhận đúng công thức giữa FE và BE

### Nên có (Should Have)

- [ ] Tất cả bug Major đã có plan fix (không nhất thiết fix xong)
- [ ] Feedback form đã thu ≥1 round từ mỗi tester
- [ ] Missing Item Requests đã được review và phân loại

### Không chặn Alpha (Won't Block)

- Bug Minor (UI polish, spacing, color)
- Export CSV/Excel (chưa có)
- Refresh tracking, transactionId (known gaps)
- Stub metrics (YouTake, Hold, CashToBalance nếu chưa wire)

---

## 6. HƯỚNG DẪN BẮT `requestId` + STATUS CODE

> **⚠️ Mọi lỗi đều phải kèm `requestId` + status code. Không có = không xử lý được.**

### Cách 1: Xem trên UI
Khi gặp lỗi, UI sẽ hiện toast/alert có chứa `Request ID: xxxxxxxx`. Copy lại.

### Cách 2: Dùng DevTools (Chrome)
1. Nhấn `F12` → chọn tab **Network**
2. Thao tác lại bước gây lỗi
3. Tìm request bị đỏ (red) trong danh sách
4. Click vào → tab **Headers**:
   - **Status Code:** `400`, `401`, `403`, `500`…
   - **Response Headers** → tìm `x-request-id`
5. Copy cả 2 giá trị vào form feedback

### Cách 3: Console
1. Nhấn `F12` → chọn tab **Console**
2. Tìm dòng lỗi có kèm `requestId`
3. Copy lại

---

_Tài liệu này là living document. Cập nhật trực tiếp trên Notion/Git khi có thay đổi._
