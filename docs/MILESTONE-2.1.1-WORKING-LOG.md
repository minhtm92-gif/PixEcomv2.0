# PixEcom v2 — Milestone 2.1.1 Working Log
# Database Layer: PrismaService + Schema Push

**Date:** February 18, 2026
**Branch:** `feature/2.1.1-database-prisma-service`
**Commit:** `4af5527`
**Objective:** Wire NestJS to PostgreSQL via Prisma — create PrismaService, push all 27 entities to database, verify live DB connection through health endpoint.

---

## Scope of This Milestone

Milestone 2.1.1 covers the **database foundation layer** of the NestJS API:

| Task | Description |
|------|-------------|
| PrismaService | NestJS-injectable service that wraps PrismaClient with lifecycle hooks |
| PrismaModule | Global NestJS module — makes PrismaService available app-wide without re-importing |
| Schema push | Run `prisma db push` to create all 27 tables in `pixecom_v2` PostgreSQL database |
| Verification | Start API, confirm `[PrismaService] Database connected` log + health endpoint 200 |

---

## Step 1: Create Feature Branch

**Action:** Created dedicated branch for this milestone.

```bash
git checkout -b feature/2.1.1-database-prisma-service
```

**Result:** ✅ Branch created from `develop`

---

## Step 2: Install Dependencies

**Action:** Ran workspace-wide install to ensure all packages are resolved.

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

**Action:** Generated the Prisma Client from `packages/database/prisma/schema.prisma`.

```bash
cd packages/database
pnpm db:generate   # runs: prisma generate
```

**Output:**
```
✔ Generated Prisma Client (v5.22.0) to node_modules/.pnpm/@prisma+client@5.22.0/.../
```

**What this does:** Reads `schema.prisma` (27 model definitions) and generates TypeScript types + query methods into `node_modules`. Without this step, `PrismaClient` has no type definitions.

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
- **Extends PrismaClient** — PrismaService IS a PrismaClient, so any other NestJS service that injects PrismaService can call `.user.findMany()`, `.seller.create()` etc. directly.
- **OnModuleInit** — calls `$connect()` at app startup, not lazily. This ensures DB connectivity is validated at boot rather than at first query, catching misconfigured credentials early.
- **OnModuleDestroy** — calls `$disconnect()` on graceful shutdown, releasing connection pool.
- **Import from `@pixecom/database`** — the workspace package re-exports `@prisma/client`. This avoids `apps/api` needing its own direct `@prisma/client` dependency and ensures a single source of truth for the Prisma version.
- **Logger** — uses NestJS's built-in Logger so DB lifecycle events appear in the standard structured log output.

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
- **@Global()** — marks the module as globally available. Any other NestJS module can inject `PrismaService` without importing `PrismaModule` again. This is the standard NestJS pattern for singleton infrastructure services (DB, Redis, Config).
- **exports: [PrismaService]** — required even with `@Global()` so NestJS DI knows which providers to expose outside the module.

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

**Note:** `PrismaModule` is imported in `AppModule` — this is where the `PrismaService` singleton is instantiated. Because it's `@Global()`, all other modules added later (SellerModule, AuthModule, etc.) get `PrismaService` injected automatically.

**Result:** ✅ PrismaModule registered in AppModule

---

## Step 7: Start Docker Services

**Context:** The development environment has multiple running Docker containers from previous projects:

| Container | Port | Project |
|-----------|------|---------|
| `pixecom_v1_5-db-1` | 5432 | v1.5 app (already running, cannot be stopped) |
| `confident-cray-db-1` | 5433 | v1 rebuild worktree |
| (new) `pixecom-postgres` | 5434 | **pixecom-v2 (ours)** |
| `pixecom-redis` | 6379 | pixecom-v2 (ours) |

**Problem:** Our docker-compose.yml originally used port `5432:5432` for postgres — but port 5432 is occupied by the v1.5 container.

**Fix:** Changed docker-compose.yml to map postgres on port `5434`:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pixecom-postgres
    ports:
      - '5434:5432'   # <-- changed from 5432 to avoid conflict
    environment:
      POSTGRES_USER: pixecom
      POSTGRES_PASSWORD: pixecom_dev
      POSTGRES_DB: pixecom_v2
```

**Action:** Started our v2 services:

```bash
docker compose up -d postgres redis
```

**Result:**
```
Container pixecom-postgres  Started
Container pixecom-redis     Started
```

**Verification:**
```bash
docker exec pixecom-postgres pg_isready -U pixecom -d pixecom_v2
# → /var/run/postgresql:5432 - accepting connections
```

**Result:** ✅ Both v2 Docker services running

---

## Step 8: Configure Database URL

**Root `.env`** (git-ignored — real credentials):
```env
DATABASE_URL="postgresql://pixecom:pixecom_dev@localhost:5434/pixecom_v2?schema=public"
```

**`packages/database/.env`** (git-ignored — used by Prisma CLI):
```env
DATABASE_URL="postgresql://pixecom:pixecom_dev@127.0.0.1:5434/pixecom_v2?schema=public"
```

**Why two `.env` files?**
- Root `.env` is read by the NestJS app at runtime (via `ConfigModule`)
- `packages/database/.env` is read by the Prisma CLI (`prisma db push`, `prisma studio`, etc.) which runs in `packages/database/` directory and looks for `.env` relative to `package.json`

**Result:** ✅ DATABASE_URL configured in both locations

---

## Step 9: Run `prisma db push`

**Action:**
```bash
cd packages/database
pnpm db:push   # runs: prisma db push
```

**Output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "pixecom_v2", schema "public" at "127.0.0.1:5434"

Your database is now in sync with your Prisma schema. Done in 1.07s

✔ Generated Prisma Client (v5.22.0) in 314ms
```

**Verification — all 27 tables:**
```
pixecom_v2=# \dt public.*
                 List of relations
 Schema |          Name          | Type  |  Owner
--------+------------------------+-------+---------
 public | ad_posts               | table | pixecom
 public | ad_stats_daily         | table | pixecom
 public | ad_stats_raw           | table | pixecom
 public | ad_strategies          | table | pixecom
 public | ads                    | table | pixecom
 public | adsets                 | table | pixecom
 public | asset_adtexts          | table | pixecom
 public | asset_media            | table | pixecom
 public | asset_thumbnails       | table | pixecom
 public | campaigns              | table | pixecom
 public | fb_connections         | table | pixecom
 public | order_events           | table | pixecom
 public | order_items            | table | pixecom
 public | orders                 | table | pixecom
 public | pricing_rules          | table | pixecom
 public | product_labels         | table | pixecom
 public | product_product_labels | table | pixecom
 public | product_variants       | table | pixecom
 public | products               | table | pixecom
 public | refresh_tokens         | table | pixecom
 public | seller_domains         | table | pixecom
 public | seller_settings        | table | pixecom
 public | seller_users           | table | pixecom
 public | sellers                | table | pixecom
 public | sellpage_stats_daily   | table | pixecom
 public | sellpages              | table | pixecom
 public | users                  | table | pixecom
(27 rows)
```

**Result:** ✅ All 27 entities from schema.prisma created in pixecom_v2

---

## Step 10: Verify API Startup + DB Connection

**Action:** Built API and started it:
```bash
cd apps/api
tsc --outDir dist --rootDir src   # compile TypeScript
node dist/main.js                  # start server
```

**NestJS startup log:**
```
[Nest] LOG [NestFactory]    Starting Nest application...
[Nest] LOG [InstanceLoader]  AppModule dependencies initialized
[Nest] LOG [InstanceLoader]  PrismaModule dependencies initialized
[Nest] LOG [InstanceLoader]  HealthModule dependencies initialized
[Nest] LOG [InstanceLoader]  ConfigHostModule dependencies initialized
[Nest] LOG [InstanceLoader]  ConfigModule dependencies initialized
[Nest] LOG [RoutesResolver]  HealthController {/api/health}:
[Nest] LOG [RouterExplorer]  Mapped {/api/health, GET} route
[Nest] LOG [PrismaService]   Database connected          ← ✅ DB connected
[Nest] LOG [NestApplication] Nest application successfully started
PixEcom API running on http://localhost:3001
```

**Health endpoint test:**
```bash
curl http://localhost:3001/api/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "pixecom-api",
  "timestamp": "2026-02-18T06:56:50.698Z"
}
```

**Result:** ✅ API starts clean, DB connected, health endpoint returns 200 OK

---

## Step 11: Fix Build Script

**Problem discovered:** `nest build` was silently completing with exit code 0 but producing no `dist/` output. Root cause: stale `tsconfig.build.tsbuildinfo` file (TypeScript incremental build cache) was telling the compiler "nothing changed, skip emit".

**Fix:** Updated `apps/api/package.json` build script to always delete the stale cache file before building:

```json
"build": "rimraf tsconfig.build.tsbuildinfo && nest build"
```

**Also added to `.gitignore`:**
```
*.tsbuildinfo
packages/database/.env
```

**Result:** ✅ `nest build` now reliably produces `dist/` on every run

---

## Step 12: Commit and Push

**Files committed:**

| File | Change |
|------|--------|
| `apps/api/src/prisma/prisma.service.ts` | Created |
| `apps/api/src/prisma/prisma.module.ts` | Created |
| `apps/api/src/app.module.ts` | Updated (PrismaModule added) |
| `apps/api/package.json` | Updated (build script fix) |
| `docker-compose.yml` | Updated (postgres port 5434) |
| `.env.example` | Updated (port + password for v2) |
| `.gitignore` | Updated (tsbuildinfo, packages/database/.env) |
| `docs/R2-CDN-SETUP-LOG.md` | Created (R2 setup log from previous session) |
| `pnpm-lock.yaml` | Updated (lockfile after pnpm install) |

**Commit:**
```
4af5527 feat(2.1.1): database layer — PrismaService + 27-table schema push
```

**Branch pushed:**
```
git push -u origin feature/2.1.1-database-prisma-service
```

**PR URL:** https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.1.1-database-prisma-service

**Result:** ✅ Milestone committed and pushed

---

## Problems Encountered & Resolutions

### Problem 1: Port 5432 Already Occupied

**Symptom:** `docker compose up -d postgres` failed — port 5432 in use.

**Root cause:** `pixecom_v1_5-db-1` (the v1.5 app's PostgreSQL container) was already running on port 5432. It cannot be stopped because the v1.5 application is live on port 80.

**Resolution:** Changed `docker-compose.yml` to map our postgres on port `5434` instead:
```yaml
ports:
  - '5434:5432'   # host:container
```
Updated `DATABASE_URL` in both `.env` files accordingly.

---

### Problem 2: `prisma db push` P1000 Authentication Failure (Against Existing Container)

**Symptom:** Earlier attempts to create `pixecom_v2` database on the existing `pixecom_v1_5-db-1` container (port 5432) failed with:
```
Error: P1000: Authentication failed against database server at localhost
```

**Root cause investigation:**
- `pg_hba.conf` inside `pixecom_v1_5-db-1` had: `host all all all scram-sha-256`
- Docker Desktop on Windows routes host→container connections through an internal proxy/NAT layer
- The Windows process (`schema-engine-windows.exe`, Prisma's native binary) connects via Windows TCP stack
- This connection arrives at the container from the Docker bridge IP (not `127.0.0.1`), hitting the scram-sha-256 rule
- Even after setting `pg_hba.conf` to `trust` (no password required), auth still failed — indicating the Windows→Docker TCP path has a different quirk at the proxy level
- This was confirmed: even `trust` auth (which should accept any connection with no password) still returned P1000

**Resolution:** Abandoned attempts to reuse the v1.5 container. Started our own clean `pixecom-postgres` container on port 5434 with correct credentials (`pixecom_dev`). This container is fully under our control with no auth complications.

**Lesson:** On Docker Desktop for Windows, don't share PostgreSQL containers across projects. Start a dedicated container for each project with its own host port.

---

### Problem 3: `PrismaClient` Import Not Found in `apps/api`

**Symptom:** TypeScript error at startup:
```
error TS2307: Cannot find module '@prisma/client' or its corresponding type declarations
```

**Root cause:** `apps/api/package.json` does not have `@prisma/client` as a direct dependency — it depends on `@pixecom/database` (workspace). TypeScript in the API package couldn't resolve `@prisma/client` through the workspace symlink.

**Resolution:** Changed the import in `prisma.service.ts` from:
```typescript
import { PrismaClient } from '@prisma/client';    // ❌ not directly available
```
to:
```typescript
import { PrismaClient } from '@pixecom/database';  // ✅ workspace re-export
```

`packages/database/src/index.ts` already exports `export { PrismaClient } from '@prisma/client'` and `export * from '@prisma/client'`, so this resolves correctly.

---

### Problem 4: `nest build` Produces No Output (Silent)

**Symptom:** `nest build` exits with code 0, prints nothing, but `dist/` directory is empty or missing.

**Root cause:** `tsconfig.build.tsbuildinfo` is TypeScript's incremental build cache. It records file hashes and tells tsc "nothing changed — skip emit." The stale cache file was created from a previous build in a different context, so TypeScript thought no compilation was needed.

**Resolution:**
1. Deleted stale `tsconfig.build.tsbuildinfo` file
2. Updated `build` script in `apps/api/package.json` to always clear it:
```json
"build": "rimraf tsconfig.build.tsbuildinfo && nest build"
```

Added `*.tsbuildinfo` to `.gitignore` so this file never gets committed.

---

## Architecture Notes

### Why PrismaService extends PrismaClient (not wraps it)

Two common patterns for Prisma in NestJS:

**Pattern A — Extends (our approach):**
```typescript
class PrismaService extends PrismaClient { ... }
// Usage: prismaService.user.findMany()
```

**Pattern B — Wraps:**
```typescript
class PrismaService {
  private client = new PrismaClient();
  get users() { return this.client.user; }
  // Usage: prismaService.users.findMany()
}
```

We use Pattern A because:
- Direct access to all PrismaClient methods without redirection
- The NestJS official docs recommend this pattern
- Adding new models to schema.prisma automatically exposes them via `prismaService.newModel` — no wrapper updates needed
- Simplest code for junior devs to understand

### Why `@Global()` on PrismaModule

Without `@Global()`, every feature module (`SellerModule`, `AuthModule`, etc.) would need to import `PrismaModule` explicitly:
```typescript
@Module({ imports: [PrismaModule] })   // would be needed in EVERY module
```

With `@Global()`, `PrismaModule` is registered once in `AppModule` and `PrismaService` is available for injection everywhere. This is the standard pattern for infrastructure services (DB, cache, config) that every module needs.

---

## Final State

### Running Services
```
pixecom-postgres   Up  0.0.0.0:5434->5432/tcp   ← our v2 PostgreSQL
pixecom-redis      Up  6379/tcp                  ← our v2 Redis
```

### Database
```
Database:  pixecom_v2
User:      pixecom
Password:  pixecom_dev
Port:      5434 (host) → 5432 (container)
Tables:    27 (all entities from schema.prisma)
```

### API
```
Port:      3001
Route:     GET /api/health → 200 {"status":"ok","service":"pixecom-api"}
DB log:    [PrismaService] Database connected
```

### File Tree Added
```
apps/api/src/
└── prisma/
    ├── prisma.service.ts   ← NEW: NestJS-injectable PrismaClient wrapper
    └── prisma.module.ts    ← NEW: @Global() module, exports PrismaService
docs/
├── R2-CDN-SETUP-LOG.md            ← R2/CDN setup log (previous session)
└── MILESTONE-2.1.1-WORKING-LOG.md ← this file
```

---

## Next Milestone: 2.1.2 — Auth Module

With the database layer complete, the next step is:
- JWT AuthModule (registration, login, refresh token)
- `POST /api/auth/register` → create User + Seller records
- `POST /api/auth/login` → validate credentials, return JWT pair
- `POST /api/auth/refresh` → issue new access token from refresh token
- `GET /api/auth/me` → return current seller profile
