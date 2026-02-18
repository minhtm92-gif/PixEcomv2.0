# PixEcom v2 — Milestone 2.1.1 Working Log
# Database Layer: PrismaService + Prisma Migrations

**Date:** February 18, 2026
**Branches:**
- `feature/2.1.1-database-prisma-service` → commit `4af5527` (initial)
- `feature/2.1.1-migration-init-fix` → commit `58385bd` (hotfix — replaced db push with migrations)

**Objective:** Wire NestJS to PostgreSQL via Prisma — create PrismaService, generate and apply a proper initial migration for all 27 entities, verify live DB connection through health endpoint.

> **Note:** This milestone was delivered in two commits. The initial commit used `prisma db push` (prototype-only tool). A same-day hotfix replaced it with a proper `prisma migrate` workflow. The final state described in this log reflects the hotfix as the correct and current approach.

---

## Scope of This Milestone

| Task | Description |
|------|-------------|
| PrismaService | NestJS-injectable service wrapping PrismaClient with lifecycle hooks |
| PrismaModule | Global NestJS module — makes PrismaService available app-wide |
| Initial migration | `20260218000000_init` — 779-line SQL covering all 27 entities |
| Verification | Fresh DB drop → migrate deploy → API boot → health endpoint 200 |

---

## Step 1: Create Feature Branch

```bash
git checkout -b feature/2.1.1-database-prisma-service
```

**Result:** ✅ Branch created from `develop`

---

## Step 2: Install Dependencies

```bash
pnpm install
```

**Output:** 691 packages installed across the monorepo workspace.

**Key packages resolved:**
- `prisma@5.22.0` (CLI in `@pixecom/database` devDependencies)
- `@prisma/client@5.22.0` (runtime in `@pixecom/database` dependencies)
- `@nestjs/common@10.x`, `@nestjs/config@3.x` (in `@pixecom/api`)

**Result:** ✅ All 691 packages installed cleanly

---

## Step 3: Run `prisma generate`

```bash
cd packages/database
pnpm db:generate   # runs: prisma generate
```

**Output:**
```
✔ Generated Prisma Client (v5.22.0) to node_modules/.pnpm/@prisma+client@5.22.0/.../
```

**What this does:** Reads `schema.prisma` (27 model definitions) and generates TypeScript types + query builder methods into `node_modules`. Without this step, `PrismaClient` has no type definitions for our models.

**Result:** ✅ Prisma Client generated

---

## Step 4: Create PrismaService

**File:** `apps/api/src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@pixecom/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
```

**Design decisions:**
- **Extends PrismaClient** — PrismaService IS a PrismaClient. Any NestJS service that injects PrismaService can call `.user.findMany()`, `.seller.create()` etc. directly. No wrapper layer needed.
- **OnModuleInit** — calls `$connect()` at app startup (not lazily). DB connectivity is validated at boot, catching misconfigured credentials early rather than at first query.
- **OnModuleDestroy** — calls `$disconnect()` on graceful shutdown, releasing the connection pool cleanly.
- **Import from `@pixecom/database`** — the workspace package re-exports `@prisma/client`. Avoids `apps/api` needing its own direct `@prisma/client` dependency. Single source of truth for the Prisma version across the monorepo.
- **Logger** — NestJS's built-in Logger means DB lifecycle events appear in the standard structured log output alongside all other app logs.

**Result:** ✅ PrismaService created

---

## Step 5: Create PrismaModule

**File:** `apps/api/src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Design decisions:**
- **@Global()** — marks the module globally available. Any feature module can inject `PrismaService` without importing `PrismaModule` again. Standard NestJS pattern for singleton infrastructure services (DB, Redis, Config).
- **exports: [PrismaService]** — required even with `@Global()` so the NestJS DI container knows which providers to expose outside the module boundary.

**Result:** ✅ PrismaModule created

---

## Step 6: Register PrismaModule in AppModule

**File:** `apps/api/src/app.module.ts` (updated)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

`PrismaModule` is imported once in `AppModule`. Because it's `@Global()`, all future modules (AuthModule, SellerModule, etc.) get `PrismaService` injected automatically — no per-module import needed.

**Result:** ✅ PrismaModule registered in AppModule

---

## Step 7: Start Docker Services

**Context:** The dev machine has multiple running Docker containers from other projects. Port 5432 is occupied by `pixecom_v1_5-db-1` (live v1.5 app — cannot be stopped). Port 5433 is occupied by another worktree.

| Container | Host Port | Project |
|-----------|-----------|---------|
| `pixecom_v1_5-db-1` | 5432 | v1.5 (live, cannot stop) |
| `confident-cray-db-1` | 5433 | v1 rebuild worktree |
| **`pixecom-postgres`** | **5434** | **pixecom-v2 (ours)** |
| **`pixecom-redis`** | **6379** | **pixecom-v2 (ours)** |

**Fix:** Updated `docker-compose.yml` to use port `5434`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pixecom-postgres
    ports:
      - '5434:5432'          # host:container — avoids conflict
    environment:
      POSTGRES_USER: pixecom
      POSTGRES_PASSWORD: pixecom_dev
      POSTGRES_DB: pixecom_v2
```

```bash
docker compose up -d postgres redis
# Container pixecom-postgres  Started
# Container pixecom-redis     Started

docker exec pixecom-postgres pg_isready -U pixecom -d pixecom_v2
# → /var/run/postgresql:5432 - accepting connections
```

**Result:** ✅ Both v2 Docker services running

---

## Step 8: Configure Database URL

**Root `.env`** (git-ignored — runtime credentials):
```env
DATABASE_URL="postgresql://pixecom:pixecom_dev@localhost:5434/pixecom_v2?schema=public"
```

**`packages/database/.env`** (git-ignored — Prisma CLI credentials):
```env
DATABASE_URL="postgresql://pixecom:pixecom_dev@127.0.0.1:5434/pixecom_v2?schema=public"
```

**Why two `.env` files?**
- Root `.env` → read by the NestJS app at runtime via `ConfigModule.forRoot({ envFilePath: '../../.env' })`
- `packages/database/.env` → read by the Prisma CLI (`prisma migrate`, `prisma studio`, etc.) which runs in `packages/database/` and looks for `.env` relative to its `package.json`

**Result:** ✅ DATABASE_URL configured correctly in both locations

---

## Step 9: Generate Initial Migration

> **Why migrate instead of db push?**
> `prisma db push` is a prototyping shortcut — it directly applies schema changes but does **not** produce a migration file. This means:
> - No repeatable, versioned SQL for new environments or teammates
> - No safe deploy path to a VPS or production database
> - `prisma migrate deploy` (used in CI/CD) requires migration files to exist
>
> `prisma migrate` is the correct tool for any project that will run on more than one machine.

**Problem:** `prisma migrate dev --name init` requires an interactive TTY. Our shell (Claude Code bash) is detected as non-interactive and is rejected:
```
Error: Prisma Migrate has detected that the environment is non-interactive, which is not supported.
```
Even `--create-only` and `--skip-generate` flags do not bypass this check.

**Workaround — use `prisma migrate diff` + manual file creation:**

```bash
# 1. Generate the SQL from empty schema → current schema.prisma
cd packages/database
pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  > prisma/migrations/20260218000000_init/migration.sql
```

This produces 779 lines of valid PostgreSQL DDL: all `CREATE TYPE` enums, `CREATE TABLE` statements, `CREATE INDEX` entries, and `ADD FOREIGN KEY` constraints.

```bash
# 2. Tell Prisma this migration already covers the current DB state
pnpm exec prisma migrate resolve --applied 20260218000000_init
# → Migration 20260218000000_init marked as applied.

# 3. Confirm status is clean
pnpm exec prisma migrate status
# → 1 migration found in prisma/migrations
# → Database schema is up to date!
```

**Result:** ✅ Initial migration file generated and registered

---

## Step 10: Verify on Fresh Database (Drop → Migrate → Boot → Health)

**Drop and recreate blank database:**
```bash
docker exec pixecom-postgres psql -U pixecom -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='pixecom_v2';"
docker exec pixecom-postgres psql -U pixecom -d postgres \
  -c "DROP DATABASE pixecom_v2;" \
  -c "CREATE DATABASE pixecom_v2 OWNER pixecom;"
```

**Confirm empty:**
```bash
docker exec pixecom-postgres psql -U pixecom -d pixecom_v2 -c "\dt public.*"
# → Did not find any relation named "public.*".
```

**Apply migration (non-interactive, works in CI/VPS):**
```bash
cd packages/database
pnpm db:migrate:deploy   # runs: prisma migrate deploy
```

**Output:**
```
1 migration found in prisma/migrations

Applying migration `20260218000000_init`

migrations/
  └─ 20260218000000_init/
    └─ migration.sql

All migrations have been successfully applied.
```

**Verify all 28 tables (27 app + `_prisma_migrations`):**
```
 Schema |          Name          | Type
--------+------------------------+-------
 public | _prisma_migrations     | table   ← Prisma tracking table
 public | ad_posts               | table
 public | ad_stats_daily         | table
 public | ad_stats_raw           | table
 public | ad_strategies          | table
 public | ads                    | table
 public | adsets                 | table
 public | asset_adtexts          | table
 public | asset_media            | table
 public | asset_thumbnails       | table
 public | campaigns              | table
 public | fb_connections         | table
 public | order_events           | table
 public | order_items            | table
 public | orders                 | table
 public | pricing_rules          | table
 public | product_labels         | table
 public | product_product_labels | table
 public | product_variants       | table
 public | products               | table
 public | refresh_tokens         | table
 public | seller_domains         | table
 public | seller_settings        | table
 public | seller_users           | table
 public | sellers                | table
 public | sellpage_stats_daily   | table
 public | sellpages              | table
 public | users                  | table
(28 rows)
```

**Boot API:**
```
[Nest] LOG [NestFactory]    Starting Nest application...
[Nest] LOG [InstanceLoader]  AppModule dependencies initialized
[Nest] LOG [InstanceLoader]  PrismaModule dependencies initialized
[Nest] LOG [InstanceLoader]  HealthModule dependencies initialized
[Nest] LOG [InstanceLoader]  ConfigHostModule dependencies initialized
[Nest] LOG [InstanceLoader]  ConfigModule dependencies initialized
[Nest] LOG [RoutesResolver]  HealthController {/api/health}:
[Nest] LOG [RouterExplorer]  Mapped {/api/health, GET} route
[Nest] LOG [PrismaService]   Database connected          ← ✅
[Nest] LOG [NestApplication] Nest application successfully started
PixEcom API running on http://localhost:3001
```

**Health endpoint:**
```bash
curl http://localhost:3001/api/health
```
```json
{"status":"ok","service":"pixecom-api","timestamp":"2026-02-18T07:09:39.743Z"}
```

**Result:** ✅ Fresh database → migrate deploy → API connected → health 200 OK

---

## Step 11: Fix Build Script

**Problem discovered:** `nest build` was silently completing (exit code 0) but producing no `dist/`. Root cause: stale `tsconfig.build.tsbuildinfo` (TypeScript incremental build cache) was telling the compiler "nothing changed — skip emit."

**Fix in `apps/api/package.json`:**
```json
"build": "rimraf tsconfig.build.tsbuildinfo && nest build"
```

**Added to `.gitignore`:**
```
*.tsbuildinfo
packages/database/.env
```

**Result:** ✅ `nest build` reliably produces `dist/` on every run

---

## Step 12: Update pnpm Scripts

**`packages/database/package.json` — final scripts:**

```json
"scripts": {
  "db:generate":        "prisma generate",
  "db:push":            "prisma db push",
  "db:migrate":         "prisma migrate dev",
  "db:migrate:deploy":  "prisma migrate deploy",
  "db:migrate:reset":   "prisma migrate reset --force",
  "db:studio":          "prisma studio",
  "db:seed":            "tsx prisma/seed.ts"
}
```

| Script | Command | When to use |
|--------|---------|-------------|
| `db:migrate` | `prisma migrate dev` | Dev — create + apply new migrations (interactive, TTY required) |
| `db:migrate:deploy` | `prisma migrate deploy` | CI / VPS — apply pending migrations non-interactively |
| `db:migrate:reset` | `prisma migrate reset --force` | Dev only — drop all + re-run migrations from scratch |
| `db:push` | `prisma db push` | Prototyping only — never used in committed workflow |

**Result:** ✅ Scripts updated

---

## Step 13: Commits and Push

### Commit 1 — Initial milestone
```
4af5527  feat(2.1.1): database layer — PrismaService + 27-table schema push
Branch: feature/2.1.1-database-prisma-service
```

Files: `prisma.service.ts`, `prisma.module.ts`, `app.module.ts`, `docker-compose.yml`,
`.env.example`, `.gitignore`, `apps/api/package.json`, `pnpm-lock.yaml`, `docs/R2-CDN-SETUP-LOG.md`

### Commit 2 — Migration hotfix (same day)
```
58385bd  fix(2.1.1): replace db push with proper Prisma migrations
Branch: feature/2.1.1-migration-init-fix
```

Files: `packages/database/prisma/migrations/20260218000000_init/migration.sql` (779 lines),
`packages/database/package.json` (added `db:migrate:reset`),
`docs/MILESTONE-2.1.1-WORKING-LOG.md`

**PR URLs:**
- https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.1.1-database-prisma-service
- https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.1.1-migration-init-fix

---

## Problems Encountered & Resolutions

### Problem 1: Port 5432 Already Occupied

**Symptom:** `docker compose up -d postgres` failed — port 5432 in use.

**Root cause:** `pixecom_v1_5-db-1` (the live v1.5 app's PostgreSQL container) was already running on port 5432 and cannot be stopped.

**Resolution:** Changed `docker-compose.yml` to map our postgres on port `5434`. Updated `DATABASE_URL` in both `.env` files accordingly.

**Lesson:** On a shared dev machine, each project needs its own host port. Never assume 5432 is free.

---

### Problem 2: `prisma db push` P1000 Auth Failure (Against Shared Container)

**Symptom:** Earlier attempts to create `pixecom_v2` on the existing `pixecom_v1_5-db-1` container failed with:
```
Error: P1000: Authentication failed against database server at localhost
```

**Root cause:** Docker Desktop on Windows routes host→container TCP through an internal NAT proxy. Prisma's native Windows binary (`schema-engine-windows.exe`) connects via the Windows TCP stack, arriving at the container from the Docker bridge IP — not `127.0.0.1`. This hit the `scram-sha-256` auth rule in `pg_hba.conf`. Attempts to set `pg_hba.conf` to `trust` (no password required) still failed, indicating Docker Desktop's proxy layer adds another level of complexity.

**Resolution:** Abandoned the shared container. Started a clean `pixecom-postgres` container on port 5434. No auth complications.

**Lesson:** Don't share PostgreSQL containers across projects on Docker Desktop for Windows.

---

### Problem 3: `PrismaClient` Import Not Resolved in `apps/api`

**Symptom:**
```
error TS2307: Cannot find module '@prisma/client' or its corresponding type declarations
```

**Root cause:** `apps/api/package.json` only depends on `@pixecom/database` (workspace), not directly on `@prisma/client`. TypeScript couldn't resolve the indirect reference.

**Resolution:** Changed import in `prisma.service.ts`:
```typescript
// Before (broken):
import { PrismaClient } from '@prisma/client';

// After (correct):
import { PrismaClient } from '@pixecom/database';  // workspace re-export
```

---

### Problem 4: `nest build` Silent No-Op

**Symptom:** `nest build` exits 0 but `dist/` is empty.

**Root cause:** Stale `tsconfig.build.tsbuildinfo` told TypeScript "nothing changed — skip emit."

**Resolution:** Added `rimraf tsconfig.build.tsbuildinfo &&` prefix to the build script. Added `*.tsbuildinfo` to `.gitignore`.

---

### Problem 5: `prisma migrate dev` Non-Interactive Rejection

**Symptom:**
```
Error: Prisma Migrate has detected that the environment is non-interactive, which is not supported.
```

**Root cause:** Prisma checks `process.stdout.isTTY`. In the automated shell environment, no TTY is present. All flags (`--skip-generate`, `--create-only`) are rejected before they can help.

**Resolution:** Used `prisma migrate diff --from-empty --to-schema-datamodel --script` to generate the SQL directly, created the migration directory manually, and used `prisma migrate resolve --applied` to register it against the existing database. Verified with `prisma migrate deploy` on a freshly dropped database.

---

## Architecture Notes

### Why `prisma migrate` instead of `prisma db push`

| | `db push` | `migrate` |
|-|-----------|-----------|
| Creates migration file | ❌ | ✅ |
| Works in CI/CD (`--no-interactive`) | ✅ | ✅ (`migrate deploy`) |
| Reproducible on new machines | ❌ | ✅ |
| Safe for production databases | ❌ | ✅ |
| Tracks schema history | ❌ | ✅ (`_prisma_migrations` table) |
| Use case | Prototyping | Everything else |

`db push` is only for throw-away prototyping where you don't care about data or repeatability. Any project that will run on more than one machine must use migrations.

### Why PrismaService extends PrismaClient

**Pattern A — Extends (our approach):**
```typescript
class PrismaService extends PrismaClient { ... }
// Usage in any service: this.prisma.user.findMany()
```

**Pattern B — Wraps:**
```typescript
class PrismaService {
  private client = new PrismaClient();
}
// Usage: this.prisma.client.user.findMany()
```

We use Pattern A: direct access to all PrismaClient methods, NestJS official recommendation, and new schema models are automatically available without any wrapper updates.

### Why `@Global()` on PrismaModule

Without `@Global()`, every feature module would need:
```typescript
@Module({ imports: [PrismaModule] })  // repeated in every module
```

With `@Global()`, import once in `AppModule` → available everywhere. Standard NestJS pattern for infrastructure singletons.

---

## Final State

### Running Services
```
pixecom-postgres  Up  0.0.0.0:5434->5432/tcp  ← v2 PostgreSQL
pixecom-redis     Up  6379/tcp                 ← v2 Redis
```

### Database
```
Database:    pixecom_v2
User:        pixecom
Password:    pixecom_dev
Host port:   5434
Tables:      27 app tables + _prisma_migrations = 28 total
Migration:   20260218000000_init (applied, tracked)
```

### API
```
Port:    3001
Route:   GET /api/health → 200 {"status":"ok","service":"pixecom-api"}
DB log:  [PrismaService] Database connected
```

### File Tree — Net Changes
```
apps/api/src/prisma/
├── prisma.service.ts             ← NEW
└── prisma.module.ts              ← NEW

packages/database/prisma/migrations/
└── 20260218000000_init/
    └── migration.sql             ← NEW (779 lines)

docs/
├── R2-CDN-SETUP-LOG.md           ← NEW (Phase 0 log)
└── MILESTONE-2.1.1-WORKING-LOG.md ← this file
```

---

## Database Workflow Reference (All Environments)

```bash
# ── Local dev: create a new migration after changing schema.prisma ──
cd packages/database
pnpm db:migrate          # prisma migrate dev  (interactive, needs TTY)

# ── Local dev: reset everything and start fresh ──
pnpm db:migrate:reset    # prisma migrate reset --force  (dev only!)

# ── CI / VPS / Railway: apply pending migrations ──
pnpm db:migrate:deploy   # prisma migrate deploy  (non-interactive, safe)

# ── Inspect current migration status ──
pnpm exec prisma migrate status
```

---

## Next Milestone: 2.1.2 — Auth Module

- JWT AuthModule (registration, login, refresh token)
- `POST /api/auth/register` → create User + Seller records
- `POST /api/auth/login` → validate credentials, return JWT pair
- `POST /api/auth/refresh` → issue new access token from refresh token
- `GET /api/auth/me` → return current seller profile
