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

| Milestone | Log | Description | Branch | Commits | Tests |
|-----------|-----|-------------|--------|---------|-------|
| 2.3.1 | [MILESTONE-2.3.1-WORKING-LOG.md](./MILESTONE-2.3.1-WORKING-LOG.md) | FB connections + ad strategies (mock-only metadata store) | `feature/2.3.1-fb-connections-ad-strategies` | `c83373f`, `2525595` | 209 E2E ✅ (179 + 30 new) |
| 2.3.4-A | [MILESTONE-2.3.4-A-WORKING-LOG.md](./MILESTONE-2.3.4-A-WORKING-LOG.md) | Ads Manager — campaign read layer + stats aggregation | `feature/2.3.4a-ads-manager-campaigns` | TBD | 240 E2E ✅ (227 + 13 new) |

---

## Release Tags

| Tag | SHA | Description |
|-----|-----|-------------|
| `v0.2.0` | `2d0c285` | Phase 2.2 complete (pre-hardening) |
| `v0.2.1` | `c45b521` | Post-hardening merge to main |

---

## Cumulative Test Suite Growth

| After Milestone | Total E2E Tests |
|----------------|----------------|
| 2.1.2 | 38 |
| 2.1.3 | 66 |
| 2.2.1 | 99 |
| 2.2.2 | 118 |
| 2.2.3 | 136 |
| 2.2.4 | 161 |
| 2.2.4.1 (hardening) | 179 |
| **2.3.1** | **209** |
| **2.3.4-A** | **240** |

---

## Up Next

| Milestone | Description |
|-----------|-------------|
| **2.3.4-B** | Ads manager — ad sets + ad-level stats + orders module + analytics dashboard |
