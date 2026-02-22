# PixEcom v2 — Documentation Index

> **Last updated:** 2026-02-21 | **Branch:** `feature/2.4.2-alpha-ads-seed-v1`

---

## Folder Structure

```
docs/
├── README.md                          ← You are here
│
├── cto/                               ← CTO strategy & governance
│   ├── CTO-ROADMAP-EXECUTION-PLAN.md        Detailed roadmap + agent prompts (active)
│   ├── PixEcom_CTO_Roadmap_Q1.docx       Q1 build roadmap (original)
│   ├── PixEcom_CTO_Executive_Summary_v2.docx  Executive summary
│   ├── AI-OPERATING-MANUAL-v2.md              AI agent roles & rules (8 agents)
│   └── PixEcom_AI_Operating_Manual_v1.docx    AI agent operating rules (v1, 6 agents)
│
├── testing/                           ← Alpha test artifacts
│   ├── ALPHA-TEST-PLAN.md                 3-day alpha test plan
│   ├── ALPHA-TEST-REPORT.md               Test results (34 PASS, 5 BUG, 2 NOTE)
│   └── alpha-test-checklist.html          Interactive HTML checklist
│
├── scripts/                           ← Sellpage embed scripts
│   ├── upsell-script.html                 Upsell banner snippet (HTML)
│   └── upsell-script.js                  Upsell banner snippet (JS)
│
└── working-logs/                      ← Milestone implementation logs
    ├── WORKING-LOGS-INDEX.md              Master index with test counts
    ├── R2-CDN-SETUP-LOG.md                Cloudflare R2 CDN setup
    ├── FRONTEND-ARCHITECTURE-PLAN.md      Frontend architecture decisions
    ├── preview-frontend-v1.md             Frontend preview v1 log
    ├── UI-checklist-phase-0.md            UI component checklist
    ├── MILESTONE-2.1.1-WORKING-LOG.md     Database layer (Prisma)
    ├── MILESTONE-2.1.2-WORKING-LOG.md     Auth module (JWT + refresh)
    ├── MILESTONE-2.1.3-WORKING-LOG.md     Seller module (tenant isolation)
    ├── MILESTONE-2.2.1-WORKING-LOG.md     Product catalog + assets
    ├── MILESTONE-2.2.2-WORKING-LOG.md     Sellpage module
    ├── MILESTONE-2.2.3-WORKING-LOG.md     Seller domains + DNS
    ├── MILESTONE-2.2.4-WORKING-LOG.md     Asset ingestion + creatives
    ├── MILESTONE-2.3.1-WORKING-LOG.md     FB connections + ad strategies
    ├── MILESTONE-2.3.1.1-WORKING-LOG.md   Connection hierarchy hardening
    ├── MILESTONE-2.3.2-WORKING-LOG.md     Campaign wizard
    ├── MILESTONE-2.3.3-WORKING-LOG.md     Stats worker (BullMQ pipeline)
    ├── MILESTONE-2.3.4-A-WORKING-LOG.md   Ads Manager campaign read
    ├── MILESTONE-2.3.4-B-WORKING-LOG.md   Ads Manager 3-tier read
    ├── MILESTONE-2.3.4-C-WORKING-LOG.md   Analytics overview (KPIs)
    └── MILESTONE-2.3.4-D-WORKING-LOG.md   Orders read layer
```

---

## Quick Links

| What | Where |
|------|-------|
| Alpha test results | [`testing/ALPHA-TEST-REPORT.md`](testing/ALPHA-TEST-REPORT.md) |
| All working logs | [`working-logs/WORKING-LOGS-INDEX.md`](working-logs/WORKING-LOGS-INDEX.md) |
| CTO roadmap (active) | [`cto/CTO-ROADMAP-EXECUTION-PLAN.md`](cto/CTO-ROADMAP-EXECUTION-PLAN.md) |
| CTO roadmap (Q1 original) | [`cto/PixEcom_CTO_Roadmap_Q1.docx`](cto/PixEcom_CTO_Roadmap_Q1.docx) |
| AI operating manual (v2) | [`cto/AI-OPERATING-MANUAL-v2.md`](cto/AI-OPERATING-MANUAL-v2.md) |

---

## Project Stats

| Metric | Value |
|--------|-------|
| Total E2E tests | 257 |
| API endpoints | 51 |
| DB models (Prisma) | 28 |
| Migrations | 7 |
| Working logs | 17 entries (15 milestones + 2 frontend tasks) |
| Admin portal pages | 20 (static preview, mock data) |
| Alpha test result | Conditional PASS (5 bugs, 3 need fix) |
