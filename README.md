# PixEcom v2 — Seller Portal

Multi-tenant SaaS seller portal. Sellers browse a shared product catalog, create sellpages, launch Facebook ads, monitor campaign performance, and view orders.

## Architecture

See `PIXECOM-V2-SYSTEM-ARCHITECTURE.md` in the project docs for the full architecture document.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | NestJS 10 (TypeScript) |
| Frontend | Next.js 14 + Tailwind CSS + Zustand |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Cache / Queue | Redis 7 + BullMQ 5 |
| Worker | BullMQ processor (separate entry point) |
| Monorepo | pnpm workspaces + Turborepo |

## Project Structure

```
pixecom-v2/
  apps/
    api/          # NestJS API server (port 3001)
    web/          # Next.js frontend (port 3000)
    worker/       # BullMQ stats-sync worker
  packages/
    database/     # Prisma schema + client
    types/        # Shared TypeScript types
    config/       # Shared ESLint & TypeScript configs
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL + Redis)

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/minhtm92-gif/PixEcomv2.0.git
cd PixEcomv2.0

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL + Redis
docker compose up -d

# 4. Copy environment file
cp .env.example .env

# 5. Generate Prisma client
pnpm db:generate

# 6. Push schema to database
pnpm db:push

# 7. Start all services in dev mode
pnpm dev
```

This starts:
- API at `http://localhost:3001`
- Web at `http://localhost:3000`
- Worker listening on `stats-sync` queue

## Common Commands

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps
pnpm lint             # Lint all apps
pnpm db:generate      # Regenerate Prisma client
pnpm db:push          # Push schema changes to DB
pnpm db:migrate       # Create and run migrations
pnpm db:studio        # Open Prisma Studio (DB browser)
```

## Environment Variables

Copy `.env.example` to `.env` and update values as needed. See the file for all available configuration options.
