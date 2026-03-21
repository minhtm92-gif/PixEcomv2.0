# PixEcom v2 — CTO Roadmap & Agent Execution Plan

## Context

**Phase A (Bug Fix) ✅ DONE** — 5 bugs fixed, ErrorBoundary, admin login separation
**Phase B (Seller Operate) ✅ DONE** — Settings, Orders full, Sellpage CRUD, Creatives UI
**Phase C (Create Ads) ⏳ PLANNING** — Meta API, Campaign wizard, Real stats sync

**Quy trình**: CTO đưa prompt → PO đưa cho Agent → PO phản hồi kết quả → CTO phân tích và đưa prompt tiếp.

**8 Agents**: CTO, Backend, Frontend, Worker, Integration, Alpha Test, Refactor, Deploy

---

## PHASE A: BUG FIX + STABILIZE (Week 1)

### A.1 — Fix 5 Alpha Bugs
**Agent: Backend**

```
BUG-01 (API 503): apps/api/src/main.ts — thêm connection pool config
BUG-02 (Session): apps/web/src/lib/apiClient.ts — fix refresh race condition
BUG-03 ($NaN): apps/web/src/app/(portal)/products/page.tsx — fix Decimal→number
BUG-04 (Invalid Date): products.service.ts — thêm createdAt vào list select
BUG-05 (0 total): Verify seed data has ACTIVE products + fix count logic
```

**Prompt cho Backend Agent:**
```
Bạn là Backend Agent của PixEcom v2. Fix 5 alpha test bugs:

## BUG-01: API 503 Intermittent (HIGH)
File: apps/api/src/main.ts
Root cause: Missing connection pool + graceful shutdown.
Fix:
1. Thêm vào DATABASE_URL: ?connection_limit=20&connect_timeout=10
2. Thêm enableShutdownHooks() trong main.ts
3. Thêm app.getHttpServer().keepAliveTimeout = 65000

## BUG-02: Session Logout (MEDIUM)
File: apps/web/src/lib/apiClient.ts (lines 57-86)
Root cause: Race condition trong refresh token dedup.
Fix: Khi _refreshPromise đã tồn tại, các request khác phải AWAIT nó rồi retry
với token mới, KHÔNG force-logout. Chỉ force-logout khi refresh thực sự fail
(HTTP 401 từ /auth/refresh).

## BUG-03: $NaN Price (MEDIUM)
File: apps/web/src/app/(portal)/products/page.tsx (line 194, 197)
Root cause: Prisma Decimal serialize thành string, moneyDecimal() nhận undefined.
Fix: Trong products.service.ts, convert Decimal fields sang number trước khi return.
Dùng pattern: Number(decimal) hoặc decimal.toNumber()

## BUG-04: Invalid Date (LOW)
File: apps/api/src/products/products.service.ts
Root cause: listProducts() không select createdAt.
Fix: Thêm createdAt: true vào PRODUCT_LIST_SELECT.

## BUG-05: 0 Total (LOW)
File: apps/web/src/app/(portal)/products/page.tsx
Root cause: API response field mapping sai.
Fix: Verify res.total matches actual count. Check API response shape.

## Rules:
- KHÔNG thay đổi schema
- KHÔNG thay đổi metric formulas
- Chạy existing E2E tests sau khi fix: pnpm test:e2e
- Commit message format: fix(module): description
```

### A.2 — Add Error Boundaries + Request Timeout
**Agent: Frontend**

**Prompt cho Frontend Agent:**
```
Bạn là Frontend Agent của PixEcom v2. Thêm 2 safety features:

## Task 1: React Error Boundary
Tạo file: apps/web/src/components/ErrorBoundary.tsx
- Class component (Error Boundaries phải là class component)
- Hiện fallback UI: "Something went wrong" + Retry button
- Log error to console
- Wrap vào (portal)/layout.tsx và tương lai (admin)/layout.tsx

## Task 2: Request Timeout
File: apps/web/src/lib/apiClient.ts
- Thêm AbortController với timeout 30s cho mọi request
- Khi timeout → throw error message "Request timeout (30s)"
- Cancel pending requests khi user navigate away

## Design rules:
- Dark theme (indigo accent, bg-background, text-foreground)
- Follow existing component patterns (no Radix, hand-written, CVA)
- KHÔNG thay đổi auth logic hay API endpoints
```

### A.3 — Admin Login Separation
**Agent: Backend → sau đó Frontend**

**Prompt cho Backend Agent (chạy trước):**
```
Bạn là Backend Agent của PixEcom v2. Tách admin/seller login:

## Task 1: Update GET /auth/me response
File: apps/api/src/auth/auth.service.ts — method getMe()
Thêm isSuperadmin vào response:
return { id, email, displayName, avatarUrl, sellerId, role, isSuperadmin }

## Task 2: Create SuperadminGuard
Tạo file: apps/api/src/auth/guards/superadmin.guard.ts
- Extends JwtAuthGuard
- Sau khi JWT valid, check req.user.isSuperadmin === true
- Nếu false → throw ForbiddenException('Superadmin access required')
- Export SuperadminGuard

## Task 3: Validate login type
File: apps/api/src/auth/auth.service.ts — method login()
KHÔNG thay đổi LoginDto. Thay vào đó:
- Thêm optional param loginType: 'seller' | 'admin' = 'seller'
- Nếu loginType === 'seller' && user.isSuperadmin → throw UnauthorizedException('Admin accounts must login at /admin')
- Nếu loginType === 'admin' && !user.isSuperadmin → throw UnauthorizedException('Not an admin account')

## Task 4: Add admin login endpoint
File: apps/api/src/auth/auth.controller.ts
Thêm: POST /auth/admin-login — gọi this.authService.login(dto, 'admin')
Giữ nguyên POST /auth/login — gọi this.authService.login(dto, 'seller')

## Rules:
- KHÔNG thay đổi schema
- KHÔNG thay đổi JWT structure (isSuperadmin đã có trong payload)
- Viết E2E tests cho admin-login endpoint
- Kiểm tra refresh flow vẫn hoạt động bình thường
```

**Prompt cho Frontend Agent (chạy sau Backend):**
```
Bạn là Frontend Agent của PixEcom v2. Tạo admin login + route guards:

## Task 1: Update AuthStore
File: apps/web/src/stores/authStore.ts
- Thêm isSuperadmin vào AuthUser interface
- Extract isSuperadmin từ GET /auth/me response
- Force-logout redirect: admin → /admin, seller → /login

## Task 2: Create Admin Login Page
Tạo: apps/web/src/app/admin/page.tsx
- Clone từ app/login/page.tsx
- Thay title: "PixEcom Admin"
- Thay subtitle: "Platform Administration"
- Call POST /auth/admin-login (thay vì /auth/login)
- Redirect thành công → /admin/dashboard
- Nếu đã login là admin → redirect /admin/dashboard
- Nếu đã login là seller → show "Bạn đang login seller, vui lòng logout trước"

## Task 3: Update Seller Login
File: apps/web/src/app/login/page.tsx
- Call POST /auth/login (giữ nguyên)
- Nếu đã login là seller → redirect /orders
- Nếu đã login là admin → show "Admin vui lòng đăng nhập tại /admin"

## Task 4: Create Admin Layout + Sidebar
Tạo: apps/web/src/app/admin/(dashboard)/layout.tsx
- Route guard: check isSuperadmin === true, nếu false → redirect /admin
- Loading skeleton giống (portal)/layout.tsx

Tạo: apps/web/src/components/AdminSidebar.tsx
NAV items: Dashboard, Sellers, Products, Orders, Assets
Brand: "PixEcom Admin"

## Task 5: Create Admin Dashboard placeholder
Tạo: apps/web/src/app/admin/(dashboard)/page.tsx
- Title: "Admin Dashboard"
- Hiện: "Coming soon — admin features will be added here"
- Cards placeholder: Total Sellers, Total Orders, Total Revenue

## Task 6: Update Seller Portal guard
File: apps/web/src/app/(portal)/layout.tsx
- Thêm check: nếu user.isSuperadmin === true → redirect /admin/dashboard
- Seller (isSuperadmin false) → render portal bình thường

## Design:
- Admin theme: Cùng dark theme nhưng accent màu amber/orange thay vì indigo
- Distinguish rõ ràng admin vs seller UI
```

---

## PHASE B: SELLER CAN OPERATE (Week 2-5)

### B.1 — Settings Page
**Agent: Frontend**

**Prompt:**
```
Bạn là Frontend Agent của PixEcom v2. Tạo Settings page cho seller.

## Backend endpoints đã có sẵn:
- GET /api/sellers/me → { id, name, slug, logoUrl, isActive }
- PATCH /api/sellers/me → body: { name?, logoUrl? }
- GET /api/sellers/me/settings → { brandName, defaultCurrency, timezone, supportEmail, metaPixelId, googleAnalyticsId }
- PATCH /api/sellers/me/settings → body: { brandName?, defaultCurrency?, timezone?, supportEmail?, metaPixelId?, googleAnalyticsId? }

## Task 1: Thêm types
File: apps/web/src/types/api.ts
Thêm interfaces: SellerProfile, SellerSettings, UpdateSellerDto, UpdateSellerSettingsDto

## Task 2: Tạo Settings page
Tạo: apps/web/src/app/(portal)/settings/page.tsx

Layout 2 sections:
### Section 1: Store Profile
- Store Name (text input, từ GET /sellers/me → name)
- Logo URL (text input, từ logoUrl)
- Save button → PATCH /sellers/me

### Section 2: Store Settings
- Brand Name (text input)
- Currency (select: USD, VND, EUR)
- Timezone (select: common timezones)
- Support Email (email input)
- Meta Pixel ID (text input)
- Google Analytics ID (text input)
- Save button → PATCH /sellers/me/settings

## Task 3: Add to Sidebar
File: apps/web/src/components/Sidebar.tsx
Thêm nav item: { label: 'Settings', href: '/settings', icon: Settings (từ lucide-react) }
Đặt cuối danh sách, trước Health.

## Design:
- Cards layout (giống order detail page)
- Toast success/error khi save
- Loading states cho fetch + submit
- Dark theme, indigo accent
```

### B.2 — Orders: Expose Hidden Fields + Expand Search
**Agent: Backend**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2. Mở rộng Orders module.

## Task 1: Expose hidden fields trong Order Detail
File: apps/api/src/orders/orders.service.ts — method getOrder()
Thêm vào response:
- trackingNumber, trackingUrl (đã có trong DB)
- paymentMethod, paymentId (đã có trong DB)
- shippingAddress (JSON field, đã có trong DB)

## Task 2: Expand search
File: apps/api/src/orders/orders.service.ts — method listOrders()
Hiện tại search chỉ match: orderNumber (startsWith) + customerEmail (contains).
Mở rộng thêm:
- customerName (contains, case-insensitive)
- customerPhone (contains)
- trackingNumber (contains, case-insensitive)
Dùng OR condition cho tất cả 5 fields.

## Task 3: Thêm field vào Order List response
File: orders.service.ts — OrderListItem
Thêm: trackingNumber (string | null) vào list response.

## Rules:
- KHÔNG thay đổi schema
- KHÔNG thêm write endpoints (chưa cần)
- Update E2E tests để verify new fields
- Giữ nguyên keyset pagination logic
- sellerId vẫn từ JWT, KHÔNG từ params
```

### B.3 — Orders: Source Attribution (Migration)
**Agent: Backend**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2. Thêm source attribution cho Orders.

## Task 1: Migration
Tạo migration thêm fields vào Order model:
- source: String? (enum-like: 'facebook', 'tiktok', 'google', 'email', 'direct', 'other')
- transactionId: String? @db.VarChar(255)
- utmSource: String? @db.VarChar(255)
- utmMedium: String? @db.VarChar(255)
- utmCampaign: String? @db.VarChar(255)
- utmTerm: String? @db.VarChar(255)
- utmContent: String? @db.VarChar(255)

Index: @@index([sellerId, source])

Command: npx prisma migrate dev --name add_order_attribution

## Task 2: Update OrderListItem
Thêm source vào list response để frontend hiện badge "Facebook" / "TikTok" etc.

## Task 3: Update OrderDetail
Thêm tất cả UTM fields + transactionId vào detail response.

## Task 4: Filter by source
Thêm optional param source vào ListOrdersQueryDto.
Cho phép filter: ?source=facebook

## Task 5: Update seed
File: packages/database/prisma/seed-alpha.ts
Update existing orders với random source values (facebook, tiktok, direct).

## Rules:
- Dùng prisma migrate dev, KHÔNG dùng db push
- Tất cả fields nullable (backward compatible)
- UTM convention theo METRICS-CONTRACT: utm_campaign=c_<campaignId>
- Viết E2E tests cho filter by source
```

### B.4 — Orders: Export CSV + Import Bulk Tracking
**Agent: Backend**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2. Tạo Orders export/import.

## Task 1: Export CSV endpoint
Tạo: GET /api/orders/export?dateFrom=...&dateTo=...&status=...
- Response: text/csv với BOM (UTF-8)
- Columns: OrderNumber, Date, Status, CustomerName, CustomerEmail, CustomerPhone,
  ProductName, VariantName, Qty, UnitPrice, LineTotal, Total, Source,
  TrackingNumber, TransactionId, ShippingAddress (1 line JSON)
- Per-OrderItem rows (1 order với 3 items = 3 rows)
- Max 5000 rows per export
- Seller-scoped (sellerId từ JWT)

## Task 2: Import CSV endpoint
Tạo: POST /api/orders/import-tracking
- Accept: multipart/form-data (CSV file)
- CSV format: OrderNumber, TrackingNumber, TrackingUrl (optional)
- Validate: OrderNumber phải thuộc seller này
- Update trackingNumber + trackingUrl cho matched orders
- Response: { updated: number, failed: { orderNumber, reason }[] }

## Task 3: Bulk status update endpoint
Tạo: PATCH /api/orders/bulk-status
- Body: { orderIds: string[], status: OrderStatus }
- Validate: tất cả orders thuộc seller
- Tạo OrderEvent cho mỗi order
- Response: { updated: number, failed: { orderId, reason }[] }

## Rules:
- Dùng Prisma transaction cho bulk operations
- Rate limit: 1 export request per 30s per seller
- CSV import max file size: 2MB
- Viết E2E tests cho cả 3 endpoints
```

**Sau đó prompt Frontend Agent:**
```
Bạn là Frontend Agent. Wire Orders export/import UI.

File: apps/web/src/app/(portal)/orders/page.tsx

## Task 1: Export button
- Thêm "Export CSV" button cạnh search bar
- Gọi GET /api/orders/export với current filters
- Download file: orders_YYYY-MM-DD.csv
- Disabled khi đang export + loading spinner

## Task 2: Import tracking modal
- Thêm "Import Tracking" button
- Modal: upload CSV file + preview table (first 5 rows)
- Submit → POST /api/orders/import-tracking
- Show results: X updated, Y failed (list failures)

## Task 3: Source badge
- Hiện badge màu bên cạnh order number: "Facebook" (blue), "TikTok" (pink),
  "Google" (green), "Email" (yellow), "Direct" (gray)
- Filter by source dropdown cạnh status filter

## Task 4: Tracking number in list
- Thêm TRACKING column vào table (hiện trackingNumber hoặc "—")

## Task 5: Order Detail updates
File: apps/web/src/app/(portal)/orders/[id]/page.tsx
- Section "Shipping": hiện shippingAddress parsed from JSON
- Section "Payment": paymentMethod + paymentId (transactionId)
- Section "Attribution": source badge + UTM params
- Enable "Refresh Tracking" button (wire to endpoint khi có)
```

### B.5 — Sellpage: Create + Edit + Publish UI
**Agent: Frontend**

**Prompt:**
```
Bạn là Frontend Agent. Wire Sellpage CRUD UI.

Backend endpoints đã có sẵn:
- POST /api/sellpages { productId, slug, domainId?, titleOverride?, descriptionOverride? }
- PATCH /api/sellpages/:id { slug?, domainId?, titleOverride?, descriptionOverride? }
- POST /api/sellpages/:id/publish
- POST /api/sellpages/:id/unpublish

Types đã có trong api.ts: SellpageListItem, SellpagesListResponse, SellpageDetail

## Task 1: "Create Sellpage" button + modal
File: apps/web/src/app/(portal)/sellpages/page.tsx
- Button "New Sellpage" góc phải trên
- Modal form: Select Product (dropdown từ GET /products), Slug (text input),
  Title Override (optional), Description Override (optional)
- Submit → POST /api/sellpages
- Success → redirect to detail page

## Task 2: Edit form trên detail page
File: apps/web/src/app/(portal)/sellpages/[id]/page.tsx
- "Edit" button → toggle inline edit mode
- Editable: slug, titleOverride, descriptionOverride
- Save → PATCH /api/sellpages/:id

## Task 3: Publish/Unpublish buttons
- DRAFT sellpage → show "Publish" button (green)
- PUBLISHED sellpage → show "Unpublish" button (yellow)
- Gọi POST /:id/publish hoặc /:id/unpublish
- Refresh data sau action

## Design:
- Modal form theo dark theme
- Toast feedback cho success/error
- Loading states
```

### B.6 — Sellpage: AdPost Endpoint + Linked Ads Dropdown
**Agent: Backend → Frontend**

**Prompt cho Backend:**
```
Bạn là Backend Agent. Tạo AdPost query endpoint.

## Context:
AdPost model đã có trong schema (links Ad → FbConnection page + creative assets).
Chain: Sellpage → Campaign (sellpageId) → Adset → Ad → AdPost

## Task 1: Create endpoint
Tạo: GET /api/sellpages/:id/linked-ads
- Query chain: Campaign (where sellpageId = :id AND sellerId) → Adset → Ad → AdPost
- Response: {
    campaigns: [{
      id, name, status,
      adsets: [{
        id, name, status,
        ads: [{
          id, name, status,
          adPost: { externalPostId, pageId, createdAt } | null
        }]
      }]
    }]
  }
- Seller-scoped

## Task 2: E2E tests
- Test empty (sellpage with no campaigns)
- Test with seeded data
- Test tenant isolation

## Rules:
- Read-only endpoint
- Efficient query (avoid N+1 — use includes/joins)
```

**Prompt cho Frontend:**
```
Bạn là Frontend Agent. Thêm "Linked Ads" section vào Sellpage detail.

File: apps/web/src/app/(portal)/sellpages/[id]/page.tsx

## Task:
Thay "Coming soon — creative assignment" bằng collapsible section:
- Title: "Linked Ads ({count})"
- Fetch: GET /api/sellpages/:id/linked-ads
- Display: Nested tree
  Campaign Name (status badge)
  └── Adset Name (status)
      └── Ad Name (status) — FB Post ID: ext_xxx
- Empty state: "No campaigns linked to this sellpage yet"
```

### B.7 — Creatives: List + Create + Edit UI
**Agent: Frontend**

**Prompt:**
```
Bạn là Frontend Agent. Tạo Creatives module UI.

Backend endpoints đã có:
- POST /api/creatives { name, creativeType, productId?, metadata? }
- GET /api/creatives → Creative[]
- GET /api/creatives/:id → Creative with assets
- PATCH /api/creatives/:id { name?, creativeType?, productId?, status?, metadata? }
- POST /api/creatives/:id/assets { assetId, role }
- DELETE /api/creatives/:id/assets/:role
- POST /api/creatives/:id/validate (DRAFT → READY)
- GET /api/creatives/:id/render

CreativeType: VIDEO_AD, IMAGE_AD, TEXT_ONLY, UGC_BUNDLE
Asset roles: PRIMARY_VIDEO, THUMBNAIL, PRIMARY_TEXT, HEADLINE, DESCRIPTION, EXTRA

## Task 1: Types
File: apps/web/src/types/api.ts
Thêm: Creative, CreativeAsset, CreateCreativeDto, etc.

## Task 2: Creatives list page
Tạo: apps/web/src/app/(portal)/creatives/page.tsx
- Table: NAME, TYPE, STATUS (DRAFT/READY/ARCHIVED), PRODUCT, CREATED
- "New Creative" button
- Filter by status, type

## Task 3: Creative detail page
Tạo: apps/web/src/app/(portal)/creatives/[id]/page.tsx
- Header: name + status badge + Edit button
- Asset Slots grid (6 slots): PRIMARY_VIDEO, THUMBNAIL, PRIMARY_TEXT, HEADLINE, DESCRIPTION, EXTRA
- Each slot: show assigned asset or "Empty" + "Assign" button
- "Validate" button (chỉ hiện khi DRAFT) → POST /:id/validate
- "Preview" button → GET /:id/render

## Task 4: Add to Sidebar
Thêm: { label: 'Creatives', href: '/creatives', icon: Palette }
Đặt sau Sellpages.

## Design:
- Asset slots dạng grid cards
- Status badge: DRAFT (gray), READY (green), ARCHIVED (red)
```

### B.8 — Products: Fix 3 Bugs + Polish
**Agent: Backend (nếu chưa fix ở A.1)**

_(Đã covered trong Phase A.1)_

---

## PHASE C: SELLER CAN CREATE ADS (Week 6-9)

### ⚠️ CRITICAL: Field Naming Convention
DB schema dùng: linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue
METRICS-CONTRACT (FROZEN) dùng: clicks, contentView, checkout, purchase, revenue
Ads Manager read service ĐÃ map DB→CONTRACT. Phase C phải giữ convention này.
- Worker ghi vào DB dùng DB field names (linkClicks, purchases, etc.)
- API response ra ngoài dùng CONTRACT field names (clicks, purchase, etc.)

---

### C.1 — Meta Marketing API Client
**Agent: Backend (Integration scope)**
**Dependencies: None**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2 (Integration scope). Tạo Meta Marketing API client module.

## Context:
- FbConnection model đã có trong DB, accessTokenEnc field đã tồn tại (nullable)
- FbConnections CRUD đã có: apps/api/src/fb-connections/
- FbConnection types: AD_ACCOUNT, PAGE, PIXEL, CONVERSION
- Hierarchy: AD_ACCOUNT → PIXEL → CONVERSION, PAGE (standalone)
- KHÔNG cần thay đổi FbConnection model/migration

## Task 1: Module structure
Tạo: apps/api/src/meta/
├── meta.module.ts
├── meta.service.ts          ← HTTP client wrapper
├── meta-token.service.ts    ← Token encryption (AES-256-GCM)
├── meta-rate-limiter.ts     ← Per-account rate limiting
├── meta.types.ts            ← Meta API response types
└── dto/
    ├── meta-campaign.dto.ts
    └── meta-insights.dto.ts

## Task 2: MetaService (HTTP client wrapper)
- HTTP client: native fetch (Node 18+ built-in, no extra deps)
- Base URL: https://graph.facebook.com/v21.0
- Auto-inject access_token từ FbConnection.accessTokenEnc (decrypt trước khi dùng)
- Methods:
  * get(path, params) → Promise<T>
  * post(path, body) → Promise<T>
  * delete(path) → Promise<T>
- Rate limit: 200 calls/hour/ad-account (Meta Business limit)
- Retry: 3x với exponential backoff (1s, 2s, 4s) cho HTTP 500/503
- Error mapping:
  * Meta error code 190 → UnauthorizedException (token expired)
  * Meta error code 17 → TooManyRequestsException (rate limit)
  * Meta error code 100 → BadRequestException (invalid params)
  * Others → InternalServerErrorException

## Task 3: MetaTokenService (encryption)
- AES-256-GCM encrypt/decrypt cho accessToken
- Key từ env: META_TOKEN_ENCRYPTION_KEY (32 bytes hex)
- IV: 12 bytes random per encryption (crypto.randomBytes(12))
- Store format: base64(iv:ciphertext:authTag) trong FbConnection.accessTokenEnc
- Methods:
  * encrypt(plainToken: string) → string (encoded)
  * decrypt(encToken: string) → string (plain token)
- .env.example: thêm META_TOKEN_ENCRYPTION_KEY=<32-byte-hex>

## Task 4: MetaRateLimiter
- In-memory Map<adAccountExternalId, { count, resetAt }>
- Method: checkLimit(adAccountId) → throws TooManyRequestsException nếu over 200/hour
- Auto-reset counter sau mỗi hour
- Tham khảo pattern: orders export rate limit (Map<sellerId, timestamp>)

## Task 5: OAuth flow endpoints
Tạo: apps/api/src/meta/meta.controller.ts
- GET /api/meta/auth-url?sellerId=...
  * Requires JWT auth
  * Returns: { url: string } — FB OAuth redirect URL
  * Scopes: ads_management, ads_read, pages_read_engagement
  * State param: encrypt(sellerId + timestamp) để verify callback
  * Env vars: META_APP_ID, META_APP_SECRET, META_REDIRECT_URI

- GET /api/meta/callback?code=...&state=...
  * Exchange code → access_token via POST graph.facebook.com/v21.0/oauth/access_token
  * Decrypt state → verify sellerId
  * Encrypt token → MetaTokenService.encrypt(accessToken)
  * Upsert FbConnection: update accessTokenEnc cho matching AD_ACCOUNT
  * Response: redirect to frontend success page

## Task 6: Import MetaModule vào AppModule
File: apps/api/src/app.module.ts — thêm MetaModule vào imports

## Rules:
- KHÔNG thay đổi schema/migration (accessTokenEnc đã có)
- KHÔNG thay đổi FbConnection service/controller
- KHÔNG viết UI
- Viết unit tests cho MetaTokenService (encrypt/decrypt roundtrip)
- Viết unit tests cho MetaRateLimiter (under/over limit)
- Tham khảo gold standard: apps/api/src/fb-connections/fb-connections.service.ts

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git add <changed-files>
git commit -m "feat(meta): Meta Marketing API client + token encryption + OAuth flow"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C1-WORKING-LOG.md
Nội dung: Date, Agent, Branch, Commit SHA, files changed, decisions, testing results.
```

---

### C.2 — Campaign CRUD Module
**Agent: Backend**
**Dependencies: C.1 (MetaService)**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2. Tạo Campaign CRUD module.

## Context:
- Campaign, Adset, Ad models ĐÃ CÓ trong schema (không cần migration)
- Campaign fields: id, sellerId, sellpageId, adAccountId, adStrategyId?, externalCampaignId?,
  name, budget, budgetType (DAILY|LIFETIME), status (ACTIVE|PAUSED|ARCHIVED|DELETED),
  deliveryStatus?, startDate?, endDate?
- Ads Manager read service ĐÃ CÓ: apps/api/src/ads-manager/ (read-only analytics)
- MetaModule ĐÃ CÓ: apps/api/src/meta/ (từ C.1) — inject MetaService cho launch/pause/resume
- FbConnection CRUD ĐÃ CÓ: apps/api/src/fb-connections/
- Sellpage CRUD ĐÃ CÓ: apps/api/src/sellpages/

## Task 1: Module structure
Tạo: apps/api/src/campaigns/
├── campaigns.module.ts
├── campaigns.service.ts
├── campaigns.controller.ts
└── dto/
    ├── create-campaign.dto.ts
    ├── update-campaign.dto.ts
    └── list-campaigns.dto.ts

## Task 2: Endpoints
POST   /api/campaigns — Create campaign
GET    /api/campaigns — List campaigns (seller-scoped, paginated, filter by status/sellpageId)
GET    /api/campaigns/:id — Get campaign detail
PATCH  /api/campaigns/:id — Update (name, budget, budgetType, startDate, endDate)
POST   /api/campaigns/:id/launch — Push to Meta API
PATCH  /api/campaigns/:id/pause — Pause on Meta
PATCH  /api/campaigns/:id/resume — Resume on Meta

## Task 3: Create flow
1. Validate sellpageId exists + belongs to seller (404 if not)
2. Validate adAccountId exists trong FbConnection + type=AD_ACCOUNT + isActive (400 if not)
3. Create Campaign record: status=DRAFT, externalCampaignId=null
4. Return created campaign

## Task 4: Launch flow
1. Load Campaign (check sellerId + status=DRAFT)
2. Load FbConnection (adAccountId) → decrypt accessTokenEnc
3. Call MetaService.post(`act_${externalId}/campaigns`, {
     name, objective: 'OUTCOME_SALES',
     status: 'ACTIVE',
     special_ad_categories: []
   })
4. Update Campaign: externalCampaignId = response.id, status = ACTIVE
5. Return updated campaign

## Task 5: Pause/Resume flow
- Pause: check status=ACTIVE → call MetaService.post(`${externalCampaignId}`, { status: 'PAUSED' }) → update local status
- Resume: check status=PAUSED → call MetaService.post(`${externalCampaignId}`, { status: 'ACTIVE' }) → update local status
- Nếu Meta API fail → throw, KHÔNG update local status (consistency)

## Task 6: List/Detail
- List: keyset pagination hoặc offset pagination (follow existing pattern)
- Detail: include sellpage name, adAccount name, adsets count
- Filter: status?, sellpageId?

## Rules:
- Seller-scoped (sellerId từ JWT)
- Campaign chỉ launch được khi status = DRAFT
- Campaign chỉ pause được khi status = ACTIVE
- Campaign chỉ resume được khi status = PAUSED
- KHÔNG thay đổi schema
- Import CampaignsModule vào AppModule
- Viết E2E tests (create, list, detail, update, launch mock, pause mock, resume mock)
  * Mock MetaService cho E2E (không gọi real Meta API trong tests)

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(campaigns): CRUD + launch/pause/resume with Meta API"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C2-BACKEND-WORKING-LOG.md
```

---

### C.3 — Campaign Wizard UI
**Agent: Frontend**
**Dependencies: C.2 (Campaign endpoints)**

**Prompt:**
```
Bạn là Frontend Agent của PixEcom v2. Tạo Campaign creation wizard + management UI.

## Backend endpoints (từ C.2):
- POST /api/campaigns { name, sellpageId, adAccountId, budget, budgetType, startDate?, endDate? }
- GET /api/campaigns → paginated list
- GET /api/campaigns/:id → detail
- PATCH /api/campaigns/:id → update
- POST /api/campaigns/:id/launch
- PATCH /api/campaigns/:id/pause
- PATCH /api/campaigns/:id/resume

## Existing:
- Ads Manager (/ads-manager) — read-only analytics dashboard ĐÃ CÓ
- Sellpages list: GET /api/sellpages
- FB Connections: GET /api/fb/connections?connectionType=AD_ACCOUNT

## Task 1: Types
File: apps/web/src/types/api.ts
Thêm: Campaign, CampaignListItem, CreateCampaignDto, UpdateCampaignDto

## Task 2: Campaigns list page
Tạo: apps/web/src/app/(portal)/campaigns/page.tsx
- Table: NAME, SELLPAGE, STATUS, BUDGET, CREATED
- Status badges: DRAFT (gray), ACTIVE (green), PAUSED (yellow), ARCHIVED (red)
- "New Campaign" button → create wizard
- Filter by status

## Task 3: Campaign create wizard (multi-step modal)
Step 1: Select Sellpage (dropdown từ GET /sellpages)
Step 2: Select Ad Account (dropdown từ GET /fb/connections?connectionType=AD_ACCOUNT)
Step 3: Campaign details: name, budget (number input), budgetType (DAILY/LIFETIME), startDate (optional), endDate (optional)
Step 4: Review & Create
- Submit → POST /api/campaigns
- Success → redirect to campaign detail

## Task 4: Campaign detail page
Tạo: apps/web/src/app/(portal)/campaigns/[id]/page.tsx
- Header: name + status badge
- Info cards: sellpage, ad account, budget, dates
- Inline edit: name, budget, budgetType, dates
- Action buttons:
  * DRAFT → "Launch Campaign" (green) → POST /:id/launch
  * ACTIVE → "Pause" (yellow) → PATCH /:id/pause
  * PAUSED → "Resume" (green) → PATCH /:id/resume
- Confirmation dialog trước launch/pause/resume

## Task 5: Add to Sidebar
File: apps/web/src/components/Sidebar.tsx
Thêm: { label: 'Campaigns', href: '/campaigns', icon: Rocket (từ lucide-react) }
Đặt sau Ads Manager.

## Design:
- Wizard modal: step indicator (1/4, 2/4...), prev/next buttons
- Dark theme, indigo accent
- Toast feedback
- Loading states

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(web): campaign wizard + list + detail + actions"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C3-FRONTEND-WORKING-LOG.md
```

---

### C.4 — Adset + Ad CRUD
**Agent: Backend**
**Dependencies: C.2 (CampaignsModule)**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2. Tạo Adset và Ad CRUD.

## Context:
- Adset model: id, campaignId, sellerId, externalAdsetId?, name, status, deliveryStatus?,
  optimizationGoal?, targeting (JsonB)
- Ad model: id, adsetId, sellerId, externalAdId?, name, status, deliveryStatus?
- CampaignsModule đã có (C.2)
- MetaService đã có (C.1)

## Task 1: Adset CRUD
Mở rộng CampaignsModule hoặc tạo module riêng:
- POST /api/campaigns/:campaignId/adsets { name, optimizationGoal?, targeting? }
- GET /api/campaigns/:campaignId/adsets → list adsets
- GET /api/adsets/:id → detail
- PATCH /api/adsets/:id { name?, optimizationGoal?, targeting?, status? }

## Task 2: Ad CRUD
- POST /api/adsets/:adsetId/ads { name }
- GET /api/adsets/:adsetId/ads → list ads
- GET /api/ads/:id → detail with adPosts
- PATCH /api/ads/:id { name?, status? }

## Task 3: AdPost linking
- POST /api/ads/:adId/ad-post { pageId, externalPostId?, assetMediaId?, assetThumbnailId?, assetAdtextId? }
  * pageId must be FbConnection type=PAGE belonging to seller
  * Validate asset IDs if provided

## Task 4: Cascade validation
- Adset create: campaign must belong to seller + status != DELETED
- Ad create: adset must belong to seller + campaign not DELETED
- AdPost create: ad must belong to seller

## Rules:
- Seller-scoped
- KHÔNG thay đổi schema
- Viết E2E tests
- Follow keyset/offset pagination pattern từ CampaignsModule

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(campaigns): adset + ad CRUD + ad-post linking"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C4-WORKING-LOG.md
```

---

### C.5 — Stats Worker Implementation
**Agent: Backend (Worker scope)**
**Dependencies: C.1 (MetaService)**

**Prompt:**
```
Bạn là Backend Agent của PixEcom v2 (Worker scope). Implement stats sync worker.

## Context:
- Worker skeleton: apps/worker/src/main.ts (BullMQ, queue "stats-sync", concurrency 5)
- MetaModule: apps/api/src/meta/ (MetaService cho API calls)
- Stats models: AdStatsRaw, AdStatsDaily, SellpageStatsDaily
- DB field names: linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue
  (API response maps these → clicks, contentView, checkout, purchase, revenue)

## Task 1: Refactor worker structure
apps/worker/src/
├── main.ts                    ← BullMQ setup + repeatable job
├── processors/
│   └── stats-sync.processor.ts  ← Job handler
├── providers/
│   ├── meta-stats.provider.ts   ← Real Meta API stats fetcher
│   └── types.ts                 ← Provider interface
└── utils/
    └── field-mapper.ts          ← Meta → DB field mapping

## Task 2: MetaStatsProvider
- Fetch: GET /{ad-account-id}/insights?fields=spend,impressions,inline_link_clicks,actions,action_values&level=campaign&time_range={"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
- Also fetch level=adset and level=ad
- Handle Meta pagination (cursors: response.paging.next)
- Handle empty data gracefully (some campaigns have no stats)

## Task 3: Field mapping (Meta → DB)
⚠️ CRITICAL — DB fields, NOT METRICS-CONTRACT fields:
- spend → spend
- impressions → impressions
- inline_link_clicks → linkClicks (DB field name)
- actions[type=content_view].value → contentViews (DB field name)
- actions[type=initiate_checkout].value → checkoutInitiated (DB field name)
- actions[type=purchase].value → purchases (DB field name)
- action_values[type=purchase].value → purchaseValue (DB field name)
- Derived (compute after sum):
  * cpm = (spend / impressions) * 1000
  * ctr = (linkClicks / impressions) * 100
  * cpc = spend / linkClicks
  * costPerPurchase = spend / purchases
  * roas = purchaseValue / spend
  * Dùng safeDivide() cho tất cả divisions

## Task 4: Stats sync processor
1. Query FbConnections (type=AD_ACCOUNT, isActive=true) cho seller
2. For each AD_ACCOUNT:
   a. Fetch Meta insights (campaign + adset + ad levels)
   b. Map to AdStatsRaw records → bulk insert
   c. Aggregate to AdStatsDaily → upsert on (sellerId, entityType, entityId, statDate)
3. Date range: last 3 days (catch late conversions)

## Task 5: Repeatable job
- Schedule: every 15 minutes
- BullMQ: worker.add('stats-sync', {}, { repeat: { every: 15 * 60 * 1000 } })
- Job data: { sellerId } or process all active sellers

## Task 6: SellpageStatsDaily aggregation
- After AdStatsDaily upsert, aggregate per sellpage:
  * Query Campaigns where sellpageId = X
  * Sum AdStatsDaily for those campaigns' entities
  * Upsert SellpageStatsDaily

## Rules:
- DB field names for storage (linkClicks, purchases, etc.)
- safeDivide() from packages/types or shared/utils
- NEVER average ratios — SUM first, derive after
- Handle Meta API errors gracefully (log + skip, don't crash worker)
- Viết unit tests cho field-mapper
- Max concurrency: 5 jobs (already configured)

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(worker): stats sync with Meta API + field mapping + daily aggregation"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C5-WORKING-LOG.md
```

---

### C.6 — Campaign Wizard Frontend (Adset/Ad/AdPost management)
**Agent: Frontend**
**Dependencies: C.4 (Adset/Ad CRUD)**

**Prompt:**
```
Bạn là Frontend Agent của PixEcom v2. Mở rộng Campaign detail page với Adset/Ad management.

## Backend endpoints (từ C.4):
- POST /api/campaigns/:campaignId/adsets { name, optimizationGoal?, targeting? }
- GET /api/campaigns/:campaignId/adsets → list
- PATCH /api/adsets/:id → update
- POST /api/adsets/:adsetId/ads { name }
- GET /api/adsets/:adsetId/ads → list
- PATCH /api/ads/:id → update
- POST /api/ads/:adId/ad-post { pageId, externalPostId? }

## Task 1: Campaign detail — Adsets section
File: apps/web/src/app/(portal)/campaigns/[id]/page.tsx
- Collapsible "Adsets" section (below campaign info)
- Fetch: GET /campaigns/:id/adsets (đã có)
- "Add Adset" button → modal: name, optimizationGoal (select), targeting JSON editor
- Each adset: expandable row showing ads inside

## Task 2: Adset → Ads
- Inside each adset row, "Add Ad" button
- Ad creation: name only
- Each ad row: name, status badge, ad-post info (if linked)

## Task 3: Ad → AdPost linking
- Inside each ad row, "Link Post" button (nếu chưa có adPost)
- Modal: Select Page (dropdown từ GET /fb/connections?connectionType=PAGE),
  External Post ID (text input, optional)
- Submit → POST /ads/:adId/ad-post
- Show linked post info (pageId, externalPostId) nếu đã có

## Task 4: Types
File: apps/web/src/types/api.ts
Thêm: Adset, Ad, AdPost, CreateAdsetDto, CreateAdDto, CreateAdPostDto

## Design:
- Nested accordion layout (Campaign → Adsets → Ads → AdPost)
- Status badges consistent with existing
- Dark theme
- Toast feedback

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(web): campaign adset/ad management + ad-post linking"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C6-FRONTEND-WORKING-LOG.md
```

---

### C.7 — Asset Upload UI
**Agent: Frontend**
**Dependencies: B.7 (Creatives UI)**

**Prompt:**
```
Bạn là Frontend Agent của PixEcom v2. Tạo Asset upload flow cho Creatives.

## Backend endpoints đã có:
- POST /api/assets/upload-url → { uploadUrl, assetId } (R2 signed URL)
- POST /api/assets { filename, mimeType, size, url } → Asset record
- POST /api/creatives/:id/assets { assetId, role } → assign asset to slot
- DELETE /api/creatives/:id/assets/:role → remove from slot

## Task 1: Upload component
Tạo: apps/web/src/components/AssetUploader.tsx
- Drag & drop zone + file picker button
- Supported types: image/*, video/mp4, video/webm
- Max size: 50MB (video), 10MB (image)
- Upload flow:
  1. GET upload URL from backend
  2. PUT file to R2 signed URL (direct upload)
  3. POST /assets to register asset record
  4. Return assetId

## Task 2: Wire to Creative asset slots
File: apps/web/src/app/(portal)/creatives/[id]/page.tsx
- Empty slot → click "Assign" → AssetUploader modal
- After upload → POST /creatives/:id/assets { assetId, role }
- Assigned slot → "Remove" button → DELETE /creatives/:id/assets/:role
- Show upload progress bar

## Task 3: Asset preview
- Image: thumbnail preview in slot card
- Video: thumbnail placeholder + "Play" icon (link to CDN URL)

## Design:
- Drag & drop zone: dashed border, icon, "Drop file here or click to browse"
- Progress bar: animated stripe
- Dark theme

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(web): asset upload + creative slot assignment"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C7-WORKING-LOG.md
```

---

### C.8 — Meta OAuth Frontend + FB Connection UI
**Agent: Frontend**
**Dependencies: C.1 (Meta OAuth endpoints)**

**Prompt:**
```
Bạn là Frontend Agent của PixEcom v2. Tạo Meta OAuth connect flow UI.

## Backend endpoints (từ C.1):
- GET /api/meta/auth-url → { url } (FB OAuth redirect)
- GET /api/meta/callback?code=...&state=... → redirects to frontend

## Existing:
- Settings page: /settings (đã có từ B.1)
- FB Connections: GET/POST/PATCH/DELETE /api/fb/connections

## Task 1: FB Connections section trong Settings
File: apps/web/src/app/(portal)/settings/page.tsx
Thêm Section 3: "Facebook Connections"
- List FbConnections (GET /fb/connections)
- Show: name, type (AD_ACCOUNT/PAGE/PIXEL), status (active/inactive badge)
- "Connect Facebook" button → calls GET /meta/auth-url → redirect to FB OAuth
- After OAuth callback redirects back → refresh connections list

## Task 2: Connection management
- Each connection: toggle active/inactive (PATCH /fb/connections/:id { isActive })
- Each connection: edit name (inline)
- Delete button → soft delete (DELETE /fb/connections/:id)

## Task 3: OAuth callback page
Tạo: apps/web/src/app/auth/meta/callback/page.tsx
- Shows "Connecting Facebook..." spinner
- Backend redirects here after OAuth success
- Auto-redirect to /settings after 2 seconds
- Error handling: show error message if callback fails

## Design:
- FB blue (#1877F2) accent for connect button
- Connection cards layout
- Dark theme

## Sau khi hoàn thành — BẮT BUỘC:
### 1. Commit & Push
git commit -m "feat(web): Meta OAuth connect + FB connections management"
git push

### 2. Viết Working Log
Tạo file: docs/working-logs/TASK-C8-WORKING-LOG.md
```

---

## PHASE D: PRODUCTION READY (Week 10-12)

### D.1 — DB/Redis Migration
**Agent: Deploy**

### D.2 — Monitoring (Sentry + Uptime)
**Agent: Deploy**

### D.3 — Multi-seller Onboarding
**Agent: Backend + Frontend**

---

## EXECUTION ORDER & DEPENDENCIES

```
Week 1:  A.1 (Backend) → A.2 (Frontend) → A.3 (Backend then Frontend)        ✅ DONE
         ↓ Alpha Test Agent re-test
Week 2:  B.1 (Frontend, Settings)     + B.2 (Backend, Orders expose)           ✅ DONE
Week 3:  B.3 (Backend, Orders source) + B.5 (Frontend, Sellpage CRUD)          ✅ DONE
Week 4:  B.4 (Backend+Frontend, CSV)  + B.6 (Backend+Frontend, AdPost)         ✅ DONE
Week 5:  B.7 (Frontend, Creatives)                                             ✅ DONE
         ↓ Alpha Test Agent full re-test (recommended)
Week 6:  C.1 (Backend, Meta API client)                                        ⏳ NEXT
Week 7:  C.2 (Backend, Campaign CRUD) + C.8 (Frontend, OAuth + FB Connections)
Week 8:  C.3 (Frontend, Campaign wizard) + C.4 (Backend, Adset/Ad CRUD)
Week 9:  C.5 (Backend/Worker, Stats sync) + C.6 (Frontend, Adset/Ad UI)
Week 10: C.7 (Frontend, Asset upload)
         ↓ Alpha Test Agent full regression
Week 11-12: Phase D (Deploy Agent)
```

## CTO CHECKPOINTS

| After | CTO verifies |
|-------|-------------|
| A.1 done ✅ | All 5 bugs fixed, E2E pass |
| A.3 done ✅ | Admin login works, seller login rejects admin |
| B.3 done ✅ | Migration clean, seed updated, no schema drift |
| B.4 done ✅ | CSV export/import works end-to-end |
| C.1 done | Meta token encryption verified, rate limiter tested |
| C.2 done | Campaign CRUD + launch/pause/resume E2E pass |
| C.5 done | Worker field mapping matches DB schema, safeDivide() used |
| Each phase | Source of Truth: METRICS-CONTRACT > TECH-SPEC > Code |

## VERIFICATION

Sau mỗi Phase:
1. Alpha Test Agent chạy full regression (39+ test cases)
2. CTO review cross-module impact
3. Deploy Agent tag release nếu pass
4. KHÔNG merge nếu E2E tests fail (Milestone Gate Protocol)
