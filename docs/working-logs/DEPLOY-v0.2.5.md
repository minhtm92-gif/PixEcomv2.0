# Deploy Log — v0.2.5

## Meta
| Field | Value |
|---|---|
| **Timestamp** | 2026-02-20T16:09Z UTC |
| **Operator** | Claude (automated) |
| **VPS IP** | 143.198.24.81 |
| **Domain** | api.pixelxlab.com |
| **Milestone** | 2.3.7 — Stability Hardening (WS1–WS5) |

## Version
| Field | Value |
|---|---|
| **RELEASE_TAG** | v0.2.5 |
| **DEPLOY_SHA** | 0bb4f5fde1edd93a0996c58e0065a05a7890d146 |
| **PREVIOUS_SHA** | 0def8ab08a2ea9adfabdbb31d099d5e7c1ff9d10 (v0.2.4) |
| **MERGE_SHA_DEVELOP** | 0bb4f5fde1edd93a0996c58e0065a05a7890d146 |
| **MERGE_SHA_MAIN** | 0bb4f5fde1edd93a0996c58e0065a05a7890d146 |

## Release Workflow
| Step | Description | Status |
|---|---|---|
| A1 | git fetch --all --tags | ✅ PASS |
| A2 | Confirm target branch exists, develop/main synced | ✅ PASS |
| A3 | Working tree clean | ✅ PASS |
| B1 | Checkout develop | ✅ PASS |
| B2 | Fast-forward merge feature/2.3.7-stability-hardening → develop | ✅ PASS |
| B3 | Push develop to origin | ✅ PASS |
| C1 | Checkout main | ✅ PASS |
| C2 | Fast-forward merge develop → main | ✅ PASS |
| C3 | Push main to origin | ✅ PASS |
| D1 | Create annotated tag v0.2.5 on MERGE_SHA_MAIN | ✅ PASS |
| D2 | Push tag to origin | ✅ PASS |
| D3 | Verify tag on origin (git ls-remote) | ✅ PASS |
| E1 | git fetch --all --tags on VPS | ✅ PASS |
| E2 | git checkout -f v0.2.5 (detached HEAD) | ✅ PASS |
| E3 | pnpm install --frozen-lockfile (+8 packages) | ✅ PASS |
| E4 | pnpm -r build (all 6 packages) | ✅ PASS |
| E5 | prisma migrate deploy — no pending migrations | ✅ PASS |
| E6 | Restart API + Worker containers | ✅ PASS |
| E7 | Post-deploy verification | ✅ PASS |

## Migrations
No new migrations in v0.2.5. Total: 6 migrations applied, schema up to date.

## Docker Status (post-deploy)
```
NAMES              STATUS                    PORTS
pixecom-api        Up 35s (healthy)          127.0.0.1:3001->3001/tcp
pixecom-worker     Up 35s
pixecom-postgres   Up 2 days (healthy)       5432/tcp
pixecom-redis      Up 2 days (healthy)       6379/tcp
```

## Verification Results

### Health Endpoint
```
HTTP/2 200

x-request-id: 1a1626da-bba1-404c-9d6b-8b30218d608a
x-response-time-ms: 7

{
  "status": "ok",
  "service": "pixecom-api",
  "timestamp": "2026-02-20T16:09:50.091Z",
  "requestId": "1a1626da-bba1-404c-9d6b-8b30218d608a",
  "db": "connected",
  "redis": "connected"
}
```

### New Headers (WS1 — Request Tracing)
- `X-Request-Id`: ✅ present (UUID per request)
- `X-Response-Time-Ms`: ✅ present (latency in ms)

### Auth Cookie (unchanged)
```
Set-Cookie: refresh_token=<redacted>; Max-Age=604800; Domain=.pixelxlab.com; Path=/api/auth/refresh; HttpOnly; Secure; SameSite=Lax
```

### Nginx
```
nginx -t → syntax ok, test successful
```

## WS1–WS5 Features Deployed
| WS | Feature | Verified |
|---|---|---|
| WS1 | Request-ID middleware + X-Request-Id header | ✅ |
| WS2 | Timing interceptor + X-Response-Time-Ms header | ✅ |
| WS3 | AppLoggerService (structured, request-scoped) | ✅ (via logs) |
| WS4 | HttpExceptionFilter (normalized error shape) | ✅ |
| WS5 | Health endpoint with db + redis status + requestId | ✅ |

## Notes
- Zero-downtime: Postgres/Redis NOT restarted (Up 2 days)
- Both merges were fast-forward (MERGE_SHA_DEVELOP == MERGE_SHA_MAIN)
- 8 new npm packages added (nest-winston, winston, winston-daily-rotate-file, etc.)
- Production tracking tag v0.2.5 (detached HEAD)
- No code modifications made during deploy
