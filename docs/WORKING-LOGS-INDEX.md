# PixEcom v2 — Working Logs Index

All milestone working logs in the `docs/` directory. Each log records implementation decisions, issues encountered, fixes applied, and test results.

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

| Milestone | Log | Description | Branch | Commit | Tests |
|-----------|-----|-------------|--------|--------|-------|
| 2.3.1 | [MILESTONE-2.3.1-WORKING-LOG.md](./MILESTONE-2.3.1-WORKING-LOG.md) | FB connections + ad strategies (mock-only metadata store) | `feature/2.3.1-fb-connections-ad-strategies` | `2525595` | 209 E2E ✅ (179 + 30 new) |
| 2.3.1.1 | *(appended to 2.3.1 log)* | Pre-2.3.2 hardening — connection hierarchy, isActive indexes, soft disable | `feature/2.3.1.1-connections-hardening` | `043e76d` | 227 E2E ✅ (209 + 18 new) |
| 2.3.2 | [MILESTONE-2.3.2-WORKING-LOG.md](./MILESTONE-2.3.2-WORKING-LOG.md) | Campaigns module — ad wizard (Campaign→AdSet→Ad→AdPost), preview, status toggle | `feature/2.3.2-campaign-wizard` | `58b1d2e` | 212 E2E ✅ (179 + 33 new) |
| 2.3.3 | [MILESTONE-2.3.3-WORKING-LOG.md](./MILESTONE-2.3.3-WORKING-LOG.md) | Stats worker — MockProvider + 3-tier pipeline + cron scheduler + manual sync API | `feature/2.3.3-stats-worker` | `a80692c` | 245 E2E ✅ (227 + 18 new) |

---

## Release Tags

| Tag | SHA | Description |
|-----|-----|-------------|
| `v0.2.0` | `2d0c285` | Phase 2.2 complete (pre-hardening) |
| `v0.2.1` | `c45b521` | Post-hardening merge to main |
| `v0.2.2` | `a0b7123` | 2.3.1 + 2.3.1.1 merged to main |

---

## Cumulative Test Suite Growth

| After Milestone | Total E2E Tests | Delta |
|----------------|----------------|-------|
| 2.1.2 | 38 | +38 |
| 2.1.3 | 66 | +28 |
| 2.2.1 | 99 | +33 |
| 2.2.2 | 118 | +19 |
| 2.2.3 | 136 | +18 |
| 2.2.4 | 161 | +25 |
| 2.2.4.1 (hardening) | 179 | +18 |
| 2.3.1 | 209 | +30 |
| 2.3.1.1 (hardening) | 227 | +18 |
| 2.3.2 | 212* | +33 |
| **2.3.3** | **245** | **+18** |

> \* 2.3.2 branch is based on develop before 2.3.1.1 merge; 212 = 179 pre-2.3.1 base + 33 new. On develop after merge: 245 (cumulative).

---

## Up Next

| Milestone | Description |
|-----------|-------------|
| 2.3.4 | Ads manager dashboard — stats read endpoints + orders module |
