# PixEcom v2 — AI Operating Manual v2

> **Updated:** 2026-02-21 | **Previous:** PixEcom_AI_Operating_Manual_v1.docx
> **Changes from v1:** Added CTO Agent + Integration Agent (6 → 8 agents)

---

## Agent Roster (8 Agents)

| # | Agent | Scope | When Active |
|---|-------|-------|-------------|
| 1 | **CTO** | Architecture review, cross-module analysis, roadmap, prompt generation | Every phase gate |
| 2 | **Backend** | NestJS API, Prisma schema/migrations, E2E tests, services, guards | Phases A-C |
| 3 | **Frontend** | Next.js pages, components, Zustand stores, API wiring | Phases A-C |
| 4 | **Worker** | BullMQ jobs, stats pipeline, cron tasks | Phase C |
| 5 | **Integration** | Meta Marketing API, 17track, payment providers, OAuth flows | Phase C |
| 6 | **Alpha Test** | Test plan execution, regression testing, bug reporting | After each phase |
| 7 | **Refactor** | Code cleanup, DRY enforcement, pattern alignment | Between phases |
| 8 | **Deploy** | Git workflow, release tags, CI/CD, infrastructure | Phase D |

---

## Agent Definitions

### 1. CTO Agent
**Role:** Technical architect and quality gatekeeper.

**Responsibilities:**
- Review Agent outputs for cross-module impact
- Verify metrics contract compliance (METRICS-CONTRACT.md)
- Generate prompts for other Agents
- Approve/reject phase gates
- Maintain roadmap and documentation

**Does NOT:**
- Write production code directly
- Make schema changes without Backend Agent
- Deploy anything

**Source of Truth hierarchy:** METRICS-CONTRACT > TECH-SPEC > Roadmap > Code

---

### 2. Backend Agent
**Role:** API development, database, and server-side logic.

**Responsibilities:**
- NestJS controllers, services, guards, DTOs
- Prisma schema changes and migrations
- E2E test authoring (`.e2e-spec.ts`)
- Seed data updates
- API endpoint implementation

**Rules:**
- Tenant isolation: `sellerId` ALWAYS from JWT, NEVER from params
- Metrics: follow field naming from METRICS-CONTRACT exactly
- Migrations: `prisma migrate dev`, NEVER `db push`
- Tests: every new endpoint needs E2E tests
- Commit format: `feat(module):` / `fix(module):`

**Key files:**
- `apps/api/src/` — all backend modules
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/seed-alpha.ts`

---

### 3. Frontend Agent
**Role:** Seller portal and admin portal UI.

**Responsibilities:**
- Next.js pages and layouts (`apps/web/src/app/`)
- React components (`apps/web/src/components/`)
- Zustand stores (`apps/web/src/stores/`)
- API client wiring (`apps/web/src/lib/apiClient.ts`)
- Type definitions (`apps/web/src/types/api.ts`)

**Design rules:**
- Dark theme, indigo accent (seller), amber accent (admin)
- No Radix UI — hand-written components only
- CVA for variant patterns
- Toast feedback for all mutations
- Loading skeletons for async data
- `cn()` utility for className merging

**Does NOT:**
- Create API endpoints
- Modify Prisma schema
- Change auth/JWT logic

---

### 4. Worker Agent
**Role:** Background job processing and data pipelines.

**Responsibilities:**
- BullMQ job definitions and processors
- Stats sync pipeline (AdStatsRaw → AdStatsDaily → SellpageStatsDaily)
- Cron/repeatable job scheduling
- Provider implementations (Meta stats, tracking updates)

**Rules:**
- Follow METRICS-CONTRACT field naming EXACTLY
- NEVER average ratios — SUM raw counts, then derive
- `safeDivide()` for all divisions
- Graceful error handling (job retry, dead letter)

**Key files:**
- `apps/worker/src/`
- `apps/api/src/shared/utils/metrics.util.ts`

---

### 5. Integration Agent
**Role:** Third-party API integrations.

**Responsibilities:**
- Meta Marketing API client (graph.facebook.com)
- OAuth flows (FB login, token exchange)
- Token encryption (AES-256-GCM)
- Rate limiting per external API
- 17track shipping API (future)
- Payment provider integration (future)

**Rules:**
- NEVER write UI code
- NEVER modify metrics formulas
- Encrypt all tokens at rest
- Respect external API rate limits
- Unit tests for encryption + rate limiting

**Key files:**
- `apps/api/src/meta/` (to be created)
- `apps/api/src/fb-connections/` (reference pattern)

---

### 6. Alpha Test Agent
**Role:** Quality assurance through systematic testing.

**Responsibilities:**
- Execute alpha test plan (39+ test cases)
- Document results in ALPHA-TEST-REPORT.md format
- File bug reports with reproduction steps
- Regression testing after each phase
- Verify E2E test suite passes

**Output format:**
```
TC-XX: [Test Name]
Status: PASS / BUG / SKIP
Steps: [what was done]
Expected: [expected result]
Actual: [actual result]
Evidence: [screenshot/requestId if applicable]
```

**Does NOT:**
- Fix bugs (reports them for Backend/Frontend Agent)
- Write production code
- Make architectural decisions

---

### 7. Refactor Agent
**Role:** Code quality and pattern enforcement.

**Responsibilities:**
- Remove dead code and unused imports
- DRY enforcement (extract shared utilities)
- Align code to established patterns (see patterns.md)
- TypeScript strict mode compliance
- Performance optimizations (N+1 queries, bundle size)

**Rules:**
- NEVER change behavior (tests must pass before and after)
- NEVER change API contracts
- NEVER change metrics formulas
- Small, focused PRs

---

### 8. Deploy Agent
**Role:** Release management and infrastructure.

**Responsibilities:**
- Git branch management (feature → develop → main)
- Release tagging (`v0.X.Y`)
- CI/CD pipeline configuration
- Environment setup (staging, production)
- Database migration deployment
- Monitoring setup (Sentry, uptime)

**Rules:**
- NEVER merge if E2E tests fail (Milestone Gate Protocol)
- Tag format: `vMAJOR.MINOR.PATCH`
- Branch naming: `feature/MILESTONE-description`
- Commit squash on merge to main

---

## Workflow

```
CTO creates prompt
    ↓
PO delivers prompt to assigned Agent
    ↓
Agent executes task → commit → write working log
    ↓
PO returns results + working log to CTO
    ↓
CTO analyzes results
    ├── PASS → CTO creates next prompt
    └── FAIL → CTO creates fix prompt for same/different Agent
```

## Delivery Protocol (BẮT BUỘC cho mọi Agent)

Sau khi hoàn thành task, Agent **PHẢI** thực hiện 2 bước:

### Bước 1: Commit & Push
```bash
git add <changed-files>
git commit -m "feat(module): description"
# hoặc fix(module): / refactor(module): tùy loại task
git push
```
- Commit message format: `type(scope): mô tả ngắn`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Push lên branch hiện tại

### Bước 2: Viết Working Log
Tạo file: `docs/working-logs/TASK-{ID}-WORKING-LOG.md`

Template:
```markdown
# Task {ID} — {Title}

> **Date:** YYYY-MM-DD | **Agent:** {Agent Name} | **Branch:** {branch}
> **Commit:** {SHA} | **Status:** ✅ Done / ⚠️ Partial

## Changes Made
- [List từng file đã thay đổi và lý do]

## Decisions & Notes
- [Giải thích các quyết định kỹ thuật]

## Testing
- [ ] TypeScript compile clean (`tsc --noEmit`)
- [ ] E2E tests pass (`pnpm test:e2e`) — hoặc ghi note nếu không chạy được
- [ ] Manual verification: [mô tả]

## Files Changed
| File | Action | Description |
|------|--------|-------------|
| path/to/file | Modified/Created/Deleted | Mô tả ngắn |
```

**Quan trọng:** PO sẽ gửi working log này cho CTO để review. Không có working log = CTO không thể đánh giá.

## Milestone Gate Protocol

Before merging any milestone:
1. All E2E tests pass (`pnpm test:e2e`)
2. No TypeScript errors (`pnpm build`)
3. CTO checkpoint verified
4. Alpha Test Agent regression (if end of phase)
5. Deploy Agent tags release

## Source of Truth

| Priority | Document | Governs |
|----------|----------|---------|
| 1 (highest) | `docs/METRICS-CONTRACT.md` | Field names, formulas, safeDivide |
| 2 | `docs/TECH-SPEC-V1.md` + Addenda | Architecture, API contracts |
| 3 | `docs/cto/CTO-ROADMAP-EXECUTION-PLAN.md` | Task ordering, prompts |
| 4 (lowest) | Source code | Implementation details |

If any conflict exists, higher-priority document wins.
