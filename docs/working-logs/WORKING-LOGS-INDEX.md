# PixEcom v2 — Working Logs Index

All milestone working logs are in this `docs/working-logs/` directory. Each log records implementation decisions, issues encountered, fixes applied, and test results.

> **Note:** Audit & competitor analysis files are in [`../audit/`](../audit/README.md)
> **Metrics contract (frozen):** [`../METRICS-CONTRACT.md`](../METRICS-CONTRACT.md)
> **2.3.X spec:** [`../TECH-SPEC-V1-ADDENDUM-2.3.X.md`](../TECH-SPEC-V1-ADDENDUM-2.3.X.md)

---

## Phase 0 — Infrastructure Setup

| Log | Description | Date |
|-----|-------------|------|
| [R2-CDN-SETUP-LOG.md](./R2-CDN-SETUP-LOG.md) | Cloudflare R2 bucket + CDN public access | 2026-02-18 |

---

## Phase 2.1 — Core Backend

| Milestone | Log | Description | Branch | Commit | Tests |
|-----------|-----|-------------|--------|--------|-------|
| 2.1.1 | [MILESTONE-2.1.1-WORKING-LOG.md](./MILESTONE-2.1.1-WORKING-LOG.md) | Database layer — PrismaService + 27-table initial migration | `feature/2.1.1-database-prisma-service` | `4af5527` → `58385bd` | Health endpoint ✅ |
| 2.1.2 | [MILESTONE-2.1.2-WORKING-LOG.md](./MILESTONE-2.1.2-WORKING-LOG.md) | Auth module — JWT access + refresh token rotation | `feature/2.1.2-auth-module` | `69eb38d` | 38 E2E ✅ |
| 2.1.3 | [MILESTONE-2.1.3-WORKING-LOG.md](./MILESTONE-2.1.3-WORKING-LOG.md) | Seller module — tenant isolation, settings, CRUD | `feature/2.1.3-seller-module` | `1673435` | 28 E2E ✅ |

---

## Phase 2.2 — Seller Commerce Layer

| Milestone | Log | Description | Branch | Commit | Tests |
|-----------|-----|-------------|--------|--------|-------|
| 2.2.1 | [MILESTONE-2.2.1-WORKING-LOG.md](./MILESTONE-2.2.1-WORKING-LOG.md) | Product catalog + asset module | `feature/2.2.1-product-catalog` | `e3e5398` | 33 E2E ✅ |
| 2.2.2 | [MILESTONE-2.2.2-WORKING-LOG.md](./MILESTONE-2.2.2-WORKING-LOG.md) | Sellpage module with tenant isolation | `feature/2.2.2-sellpages` | `edf3e20` | 19 E2E ✅ |
| 2.2.3 | [MILESTONE-2.2.3-WORKING-LOG.md](./MILESTONE-2.2.3-WORKING-LOG.md) | Seller domain module with DNS verification stub | `feature/2.2.3-seller-domains` | `d020293` | 18 E2E ✅ |
| 2.2.4 | [MILESTONE-2.2.4-WORKING-LOG.md](./MILESTONE-2.2.4-WORKING-LOG.md) | Multi-source asset ingestion + creative layer | `feature/2.4-asset-creative-layer` | `2d0c285` | 25 E2E ✅ |
| 2.2.4.1 | *(included in 2.2.4 log)* | Pre-v2.3 hardening — creativeType, render endpoint, EXTRA multi-slot, dual API key rotation, rate limiting | `feature/2.4-asset-creative-layer` | `5776a1b` | 179 E2E + 7 unit ✅ |

---

## Phase 2.3 — Facebook Ads Layer

| Milestone | Log | Description | Branch | Commits | Tests |
|-----------|-----|-------------|--------|---------|-------|
| 2.3.1 | [MILESTONE-2.3.1-WORKING-LOG.md](./MILESTONE-2.3.1-WORKING-LOG.md) | FB connections + ad strategies (mock-only metadata store) | `feature/2.3.1-fb-connections-ad-strategies` | `c83373f`, `2525595` | 209 E2E ✅ (179 + 30 new) |
| 2.3.1.1 | [MILESTONE-2.3.1.1-WORKING-LOG.md](./MILESTONE-2.3.1.1-WORKING-LOG.md) | Pre-2.3.2 hardening — connection hierarchy, isActive indexes, soft disable | `feature/2.3.1.1-connections-hardening` | `145259f` → `043e76d` → merged `a0b7123` | 227 E2E ✅ (+18) |
| 2.3.2 | [MILESTONE-2.3.2-WORKING-LOG.md](./MILESTONE-2.3.2-WORKING-LOG.md) | Campaign wizard — create/launch campaigns via FB connections + ad strategies | `feature/2.3.2-campaign-wizard` | `58b1d2e` | 212 E2E ✅ |
| 2.3.3 | [MILESTONE-2.3.3-WORKING-LOG.md](./MILESTONE-2.3.3-WORKING-LOG.md) | Stats worker — BullMQ 3-tier pipeline + MockProvider | `feature/2.3.3-stats-worker` | `a80692c` | 245 E2E ✅ |
| 2.3.4-A | [MILESTONE-2.3.4-A-WORKING-LOG.md](./MILESTONE-2.3.4-A-WORKING-LOG.md) | Ads Manager — campaign read layer + stats aggregation | `feature/2.3.4a-ads-manager-campaigns` | `23f2786` | 240 E2E ✅ (227 + 13 new) |
| 2.3.4-C | [MILESTONE-2.3.4-C-WORKING-LOG.md](./MILESTONE-2.3.4-C-WORKING-LOG.md) | Analytics Overview — seller KPI dashboard (revenue, cost, money model) | `feature/2.3.4c-analytics-overview` | `2dc6a7a` | 240 E2E ✅ (227 + 13 new) |
| 2.3.4-D | [MILESTONE-2.3.4-D-WORKING-LOG.md](./MILESTONE-2.3.4-D-WORKING-LOG.md) | Orders Read Layer — list + detail, keyset pagination, no-leak contract | `feature/2.3.4d-orders-read-layer` | `46242c4` | 241 E2E ✅ (227 + 14 new) |
| 2.3.4-B | [MILESTONE-2.3.4-B-WORKING-LOG.md](./MILESTONE-2.3.4-B-WORKING-LOG.md) | Ads Manager 3-Tier Read Layer — Campaign/Adset/Ad + metrics contract | `feature/2.3.4b-ads-manager-3tier` | `6dd681c` | 257 E2E ✅ (241 + 16 new) |

---

## Release Tags

| Tag | SHA | Description |
|-----|-----|-------------|
| `v0.2.0` | `2d0c285` | Phase 2.2 complete (pre-hardening) |
| `v0.2.1` | `c45b521` | Post-hardening merge to main |
| `v0.2.2` | `a0b7123` | Phase 2.3.1.1 hardening merged to develop |

---

## Cumulative Test Suite Growth

| After Milestone | Total E2E Tests | Delta |
|----------------|----------------|-------|
| 2.1.2 | 38 | — |
| 2.1.3 | 66 | +28 |
| 2.2.1 | 99 | +33 |
| 2.2.2 | 118 | +19 |
| 2.2.3 | 136 | +18 |
| 2.2.4 | 161 | +25 |
| 2.2.4.1 (hardening) | 179 | +18 |
| **2.3.1** | **209** | +30 |
| 2.3.1.1 | 227 | +18 |
| 2.3.2 | 212 | *(feature branch)* |
| 2.3.3 | 245 | *(feature branch)* |
| **2.3.4-A** | **240** | +13 *(off develop base 227)* |
| **2.3.4-C** | **240** | +13 *(off develop base 227)* |
| **2.3.4-D** | **241** | +14 *(off develop base 227)* |
| **2.3.4-B** | **257** | +16 *(off develop base 241)* |

---

## Phase 2.4 — Frontend Preview & Admin Portal

| Task | Log | Description | Branch | Commits | Build |
|------|-----|-------------|--------|---------|-------|
| C2-Frontend | [TASK-C2-FRONTEND-WORKING-LOG.md](./TASK-C2-FRONTEND-WORKING-LOG.md) | Ads Manager inline actions + bulk + sync; Sellpage domain/pixel/linked-ads; Orders status transitions; C2-FIX (3 regression bugs) | `feature/2.4.2-alpha-ads-seed-v1` | `0e27205`, `0c874de` | GREEN (34 routes) |
| D-PREVIEW-1 | [TASK-D-PREVIEW-1-WORKING-LOG.md](./TASK-D-PREVIEW-1-WORKING-LOG.md) | Admin portal UI — 20 pages with static mock data (Dashboard, Sellers, Orders, Products, Stores, Analytics, Settings hub + 10 sub-pages) | `feature/2.4.2-alpha-ads-seed-v1` | `4749b51` | GREEN (35 routes) |
| D-PREVIEW-2 | [TASK-D-PREVIEW-2-WORKING-LOG.md](./TASK-D-PREVIEW-2-WORKING-LOG.md) | Customer-facing Storefront UI — LynsieCharm sellpage + cart + checkout + tracking + policy pages (light theme, 13 components, 5 page types) | `feature/2.4.2-alpha-ads-seed-v1` | `98537d9` | GREEN (45 routes) |
| D-PREVIEW-3A | [TASK-D-PREVIEW-3A-WORKING-LOG.md](./TASK-D-PREVIEW-3A-WORKING-LOG.md) | Preview mode bypass — NEXT_PUBLIC_PREVIEW_MODE flag skips admin auth; /preview hub landing page; cross-nav (AdminSidebar ↔ StorefrontFooter) | `feature/2.4.2-alpha-ads-seed-v1` | `64cc142` | GREEN (46 routes) |

---

## Up Next

| Milestone | Description | Spec | Status |
|-----------|-------------|------|--------|
| **2.3.4-B** | Ads Manager 3-Tier Read Layer (Campaign/Adset/Ad + metrics contract) | — | ✅ Done |
| **2.3.X** | Ads Manager Full Read Layer + Store Funnel Join + Orders Tracking Upgrade | [`TECH-SPEC-V1-ADDENDUM-2.3.X.md`](../TECH-SPEC-V1-ADDENDUM-2.3.X.md) | 🔄 Pending |
| **D-PREVIEW-3** | Admin portal + Seller portal API wiring (replace mock data with real endpoints) | — | Pending |

### 2.3.X Phase Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| PHASE 0 | Precheck — branch `feature/2.3.4d-orders-read-layer`, schema valid, 241/241 E2E ✅ | ✅ Done (`dd7fa9c`) |
| PHASE 1 | Migration — UTM fields + tracking fields on Order, autoTrackingRefresh on SellerSettings, 4 indexes | ⏳ Awaiting confirmation |
| PHASE 2 | Metrics engine — `apps/api/src/shared/utils/metrics.util.ts` + unit tests | ⏳ Pending |
| PHASE 3 | AdsManager campaign level — 3-source join + store funnel + unattributed bucket | ⏳ Pending |
| PHASE 4 | AdsManager adset level — `GET /ads-manager/adsets?campaignId=...` | ⏳ Pending |
| PHASE 5 | AdsManager ad level — `GET /ads-manager/ads?adsetId=...` | ⏳ Pending |
| PHASE 6 | Orders tracking refresh — TrackingProvider + SevenTrack stub + `POST /orders/:id/refresh-tracking` | ⏳ Pending |
