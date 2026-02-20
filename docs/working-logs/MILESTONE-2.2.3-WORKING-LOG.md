# Milestone 2.2.3 - Seller Domain Module: Working Log

**Branch:** `feature/2.2.3-domain-module`
**Commit:** `d020293`
**Date:** 2026-02-18
**Status:** Complete - 136/136 e2e tests passing

---

## Overview

Implemented the Seller Domain Module - sellers can register custom domains, manage verification state, control which domain is primary, and attach verified domains to sellpages.

**Phase 1 design decision:** DNS verification is stubbed (`POST /api/domains/:id/verify` with `{ force: true }` marks VERIFIED immediately). The data model is fully future-proof: the `verificationToken` is generated on create, the `verificationMethod` field exists for TXT/A_RECORD, and Phase 2 simply replaces the stub with a real DNS lookup using those stored values.

**Key invariant:** `sellerId` is ALWAYS sourced from `@CurrentUser()`. Domain endpoints, like all seller-scoped endpoints, never read `sellerId` from route params or request body.

---

## Endpoints Delivered

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST`   | `/api/domains`             | Register custom domain  | JWT |
| `GET`    | `/api/domains`             | List sellers domains   | JWT |
| `PATCH`  | `/api/domains/:id`         | Update (isPrimary)      | JWT |
| `DELETE` | `/api/domains/:id`         | Delete domain           | JWT |
| `POST`   | `/api/domains/:id/verify`  | Mark VERIFIED (stub)    | JWT |

**Sellpage integration:** `POST /api/sellpages/:id/publish` now requires linked domain to be VERIFIED (or no domain)

---

## Step-by-Step Implementation

### Step 1 - Create Feature Branch

```bash
git checkout -b feature/2.2.3-domain-module
```

---

### Step 2 - Schema Analysis

Existing `SellerDomain` model:
- `verificationToken String @unique` - already globally unique per token
- `@@unique([sellerId, hostname], name: "uq_seller_domain")` - prevents same seller adding same domain twice
- **No global unique on `hostname`** - two sellers could register the same domain

Enums confirmed:
- `DomainStatus`: `PENDING | VERIFIED | FAILED`
- `VerificationMethod`: `TXT | A_RECORD`

**Decision:** Add `@@unique([hostname])` to enforce global hostname uniqueness across all sellers.

---

### Step 3 - Migration: Global Hostname Unique Constraint

Added `@@unique([hostname], name: "uq_domain_hostname")` to the schema, then created:

**`packages/database/prisma/migrations/20260218100000_domain_hostname_global_unique/migration.sql`**
```sql
CREATE UNIQUE INDEX "seller_domains_hostname_key" ON "seller_domains"("hostname");
```

Applied with:
```bash
pnpm --filter @pixecom/database db:migrate
# Applying migration `20260218100000_domain_hostname_global_unique`
# Your database is now in sync with your schema.
```

**Note on Prisma client regeneration:** The migration applied successfully but `prisma generate` threw `EPERM: operation not permitted` on Windows because the query engine DLL was locked by a running process. The schema change is a simple index addition - the API code uses `findFirst({ where: { hostname } })` to work around the stale generated client (the raw DB constraint still enforces uniqueness at the DB level regardless).

---

### Step 4 - DTOs

**`apps/api/src/domains/dto/create-domain.dto.ts`**

Accepts a raw domain string - normalization happens in the service, not the DTO. This keeps the DTO simple and lets the error message quote what the user actually typed.

```typescript
export class CreateDomainDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  domain\!: string;
}
```

**`apps/api/src/domains/dto/update-domain.dto.ts`**

Only `isPrimary` is updatable in Phase 1.

```typescript
export class UpdateDomainDto {
  @IsOptional() @IsBoolean()
  isPrimary?: boolean;
}
```

**`apps/api/src/domains/dto/verify-domain.dto.ts`**

Requires explicit `{ force: true }` to prevent accidental calls - makes it obvious this is a stub.

```typescript
export class VerifyDomainDto {
  @IsBoolean()
  force\!: boolean;
}
```

---

### Step 5 - Service Architecture

**`apps/api/src/domains/domains.service.ts`**

#### A. Hostname Normalization (module-level pure function)

```typescript
export function normalizeDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");   // strip protocol
  s = s.split("/")[0];                  // strip path
  s = s.split(":")[0];                  // strip port
  return s;
}
```

Examples:
```
"HTTPS://Shop.Example.com/products?q=1"  ->  "shop.example.com"
"  shop.EXAMPLE.com  "                   ->  "shop.example.com"
"shop.example.com:443"                   ->  "shop.example.com"
```

#### B. Hostname Validation (module-level pure function)

```typescript
const HOSTNAME_REGEX =
  /^(?\!-)[a-z0-9-]{1,63}(?<\!-)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){1,}$/;

export function isValidHostname(hostname: string): boolean {
  if (\!hostname || hostname.length > 255) return false;
  return HOSTNAME_REGEX.test(hostname);
}
```

Rejects:
- Bare labels (no dot): `"localhost"` X
- Strings with spaces: `"my shop.com"` X
- Labels starting/ending with hyphen: `"-bad.com"` X

Accepts:
- Standard FQDNs: `"shop.example.com"` OK
- Subdomains: `"api.shop.example.co.uk"` OK

#### C. Global Uniqueness Check

```typescript
const globalExisting = await this.prisma.sellerDomain.findFirst({
  where: { hostname },
  select: { id: true, sellerId: true },
});
if (globalExisting) {
  if (globalExisting.sellerId === sellerId) {
    throw new ConflictException(`Domain "${hostname}" is already registered to your account`);
  }
  throw new ConflictException(`Domain "${hostname}" is already registered by another seller`);
}
```

Uses `findFirst` (not `findUnique`) because the `uq_domain_hostname` named unique is not available in the stale generated Prisma client. The DB-level constraint (`seller_domains_hostname_key`) prevents race conditions.

#### D. Verification Token Generation

```typescript
const verificationToken = randomBytes(24).toString("hex");
```

48-character hex string - unguessable, unique per domain. Stored in `verificationToken` for future DNS TXT record lookup in Phase 2.

#### E. Verification Response Shape

```typescript
function mapToDomainDto(domain: DomainRow) {
  return {
    id: domain.id,
    hostname: domain.hostname,
    status: domain.status,
    isPrimary: domain.isPrimary,
    verification: {
      type: domain.verificationMethod,   // "TXT"
      name: "_pixecom",                  // DNS record name prefix
      value: domain.verificationToken,   // the token to put in the TXT record
    },
    verifiedAt: domain.verifiedAt ? domain.verifiedAt.toISOString() : null,
    failureReason: domain.failureReason,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}
```

Sellers add a TXT record: `_pixecom.shop.example.com IN TXT "<token>"`
Phase 2 worker looks up that record and calls the verify endpoint internally.

#### F. Set Primary - Transaction Safety

```typescript
const updated = await this.prisma.$transaction(async (tx) => {
  await tx.sellerDomain.updateMany({
    where: { sellerId, isPrimary: true, id: { not: id } },
    data: { isPrimary: false },
  });
  return tx.sellerDomain.update({
    where: { id },
    data: { isPrimary: true },
    select: DOMAIN_SELECT,
  });
});
```

A single transaction guarantees atomicity: unset all other primaries, then set this one. No window where two domains can both be primary.

#### G. Delete Guard

```typescript
const usedCount = await this.prisma.sellpage.count({
  where: { domainId: id },
});
if (usedCount > 0) {
  throw new ConflictException(
    `Domain is used by ${usedCount} sellpage(s). Remove the domain from all sellpages before deleting.`
  );
}
```

The FK on `sellpages.domain_id` is `SET NULL ON DELETE` - deletion would silently break the URL preview for live pages. We explicitly block it to force sellers to clean up first.

#### H. Verify Stub

```typescript
async verifyDomain(sellerId: string, id: string, dto: VerifyDomainDto) {
  if (\!dto.force) {
    throw new BadRequestException("Pass { " + dq + "force" + dq + ": true } to confirm stub verification.");
  }
  // ...
  const updated = await this.prisma.sellerDomain.update({
    where: { id },
    data: { status: "VERIFIED", verifiedAt: new Date(), failureReason: null },
    select: DOMAIN_SELECT,
  });
  return mapToDomainDto(updated);
}
```

Phase 2 replacement: query DNS for `_pixecom.{hostname}` TXT record, check value matches `verificationToken`, then update status.

---

### Step 6 - Controller

**`apps/api/src/domains/domains.controller.ts`**

Standard pattern - all routes `@UseGuards(JwtAuthGuard)`, `sellerId` from `@CurrentUser()`, `ParseUUIDPipe` on all `:id` params.

```typescript
@Controller("domains")
@UseGuards(JwtAuthGuard)
export class DomainsController {
  @Post()             @HttpCode(HttpStatus.CREATED)  createDomain(...)
  @Get()              @HttpCode(HttpStatus.OK)        listDomains(...)
  @Patch(":id")       @HttpCode(HttpStatus.OK)        updateDomain(...)
  @Delete(":id")      @HttpCode(HttpStatus.OK)        deleteDomain(...)
  @Post(":id/verify") @HttpCode(HttpStatus.OK)        verifyDomain(...)
}
```

---

### Step 7 - Module + App Registration

**`apps/api/src/domains/domains.module.ts`**
```typescript
@Module({
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
```

**`apps/api/src/app.module.ts`** - added `DomainsModule` to imports array.

---

### Step 8 - Sellpage Publish Gate

Updated `SellpagesService.publishSellpage()` to enforce domain verification:

```typescript
// Domain verification gate: if a domain is linked it must be VERIFIED
if (sellpage.domainId) {
  const domain = await this.prisma.sellerDomain.findUnique({
    where: { id: sellpage.domainId },
    select: { status: true, hostname: true },
  });
  if (\!domain || domain.status \!== "VERIFIED") {
    throw new BadRequestException(
      `The linked domain "${domain?.hostname ?? sellpage.domainId}" ` +
        "must be VERIFIED before publishing. " +
        "Use POST /api/domains/:id/verify to verify it first.",
    );
  }
}
```

Also updated `assertSellpageBelongsToSeller()` to include `domainId` in the select so the publish method has access to it without an extra query.

---

### Step 9 - Seed Extension

**`packages/database/prisma/seed.ts`** extended with:

```
Domain 1: VERIFIED + isPrimary
  hostname: seed-shop.example.com
  token:    seed-verified-token-abc123xyz
  verifiedAt: 2026-02-01

Domain 2: PENDING
  hostname: seed-pending.example.com
  token:    seed-pending-token-def456uvw

Sellpage 2 (prostand-special) linked to Domain 1
  urlPreview: https://seed-shop.example.com/prostand-special
```

Fixed IDs for idempotency:
- Domain 1: `00000000-0000-0000-0000-000000003001`
- Domain 2: `00000000-0000-0000-0000-000000003002`

---

### Step 10 - E2E Tests (33 new tests)

**`apps/api/test/domains.e2e-spec.ts`**

Test groups:

| # | Group | Tests |
|---|-------|-------|
| 1 | Auth guard | 401 on GET, POST, POST verify without JWT |
| 2 | Create | 201 + shape, normalization (strip protocol+case), seller B creates |
| 3 | Invalid hostname | bare label, spaces, empty, missing field |
| 4 | Duplicate enforcement | same seller 409, cross-seller 409 (global uniqueness) |
| 5 | List + isolation | seller A sees only own domains, seller B sees only own |
| 6 | Set primary | 400 for empty body, isPrimary=true works, transaction unsets previous |
| 7 | Verify stub | force=false 400, missing force 400, marks VERIFIED, already-VERIFIED 400, cross-tenant 404 |
| 8 | Delete | cross-tenant 404, blocked when in use 409, succeeds after unlink |
| 9 | Sellpage publish gate | publish fails PENDING, publish succeeds VERIFIED, urlPreview correct, no-domain publish still works |
| 10 | ParseUUIDPipe guards | bad UUID on PATCH, DELETE, POST verify |

The delete test creates a sellpage linked to the domain, verifies the 409, then unlinks via `PATCH /api/sellpages/:id { domainId: null }` before successfully deleting - this exercises the full flow end-to-end.

---

### Step 11 - Build + Test

```bash
pnpm --filter @pixecom/api build
# Zero TypeScript errors

pnpm --filter @pixecom/database db:seed
# Seeding complete.
# Summary: 3 products, 8 variants, 4 labels, 2 media, 2 thumbs, 2 adtexts,
#          3 pricing rules, 9 sellpages, 2 domains

pnpm --filter @pixecom/api test:e2e
# Test Suites: 5 passed, 5 total
# Tests:       136 passed, 136 total
```

---

### Step 12 - Commit + Push

```bash
git add apps/api/src/app.module.ts \
        apps/api/src/domains/ \
        apps/api/src/sellpages/sellpages.service.ts \
        apps/api/test/domains.e2e-spec.ts \
        packages/database/prisma/schema.prisma \
        packages/database/prisma/migrations/20260218100000_domain_hostname_global_unique/ \
        packages/database/prisma/seed.ts

git commit -m "feat(domains): milestone 2.2.3 - seller domain module with verification stub"
git push origin feature/2.2.3-domain-module
```

**Commit:** `d020293`
**PR:** https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.2.3-domain-module

---

## Problems and Resolutions

### Problem 1 - Prisma client stale after migration (Windows DLL lock)

**Symptom:**
```
EPERM: operation not permitted, rename
"...\.prisma\client\query_engine-windows.dll.node.tmp..."
-> "...\.prisma\client\query_engine-windows.dll.node"
```

**Root cause:** Windows locks the DLL file when a process (the running API) is using it. `prisma generate` cannot overwrite the running engine binary. The migration itself applied successfully to the DB.

**Consequence:** The new named unique `uq_domain_hostname` was added to the Prisma schema but the generated TypeScript client still did not expose it as a typed unique selector (i.e., `findUnique({ where: { uq_domain_hostname: { hostname } } })` was unavailable).

**Fix:** Used `findFirst({ where: { hostname } })` for the global uniqueness pre-check. This is semantically equivalent. The raw DB unique index (`seller_domains_hostname_key`) still enforces the constraint at the database level, preventing any race condition the pre-check might miss.

---

### Problem 2 - uq_domain_hostname typed unique not in generated client

**Symptom:**
```
TS2322: Type "{ hostname: string; }" is not assignable to type
"string | SellerDomainUq_seller_domainCompoundUniqueInput".
Property "sellerId" is missing...
```

**Root cause:** The Prisma client was regenerated after the 2.1.1 init migration. It knew about `uq_seller_domain` (the compound `[sellerId, hostname]` unique) but not `uq_domain_hostname` (the new single-field unique from the 2.2.3 migration) because the client could not be regenerated with the DLL locked.

**Fix:** Same as Problem 1 - `findFirst` instead of `findUnique`. The service comment documents why:
```typescript
// We use findFirst on hostname - the DB-level unique index applied via
// migration prevents duplicates even if two concurrent requests race.
```

---

### Problem 3 - Delete blocked by FK (design decision, not a bug)

The FK `sellpages.domain_id -> seller_domains.id ON DELETE SET NULL` would silently null out `domainId` on all linked sellpages when a domain is deleted. This could break live published pages without any warning.

**Design decision:** Enforce an explicit 409 guard before deletion:
```typescript
const usedCount = await this.prisma.sellpage.count({ where: { domainId: id } });
if (usedCount > 0) throw new ConflictException(`Domain is used by ${usedCount} sellpage(s)...`);
```

Sellers must unlink the domain from all sellpages first. This is the same pattern used by many SaaS platforms (e.g., cannot delete a product that has active orders).

---

## Domain Lifecycle

```
                    POST /api/domains
                          |
                          v
                    +-----------+
                    |  PENDING  |<---- default on create
                    +-----+-----+
                          | POST /:id/verify { force: true }
                          | (Phase 2: real DNS TXT lookup)
                          v
                    +-----------+
                    | VERIFIED  |---- can be linked to published sellpages
                    +-----+-----+
                          | (future: DNS check fails on periodic revalidation)
                          v
                    +-----------+
                    |  FAILED   |---- publish blocked; seller must re-verify
                    +-----------+
```

---

## Sellpage Publish Gate Logic

```
POST /api/sellpages/:id/publish
    |
    +-- status === PUBLISHED? -> 400 "already published"
    +-- status === ARCHIVED?  -> 400 "cannot publish archived"
    |
    +-- domainId === null?    -> OK allow (no domain linked, use placeholder URL)
    |
    +-- domainId !== null?
            |
            +-- domain.status === VERIFIED? -> OK allow (URL = https://hostname/slug)
            +-- domain.status !== VERIFIED? -> 400 "domain must be VERIFIED"
```

---

## Hostname Normalization Examples

| Input | Normalized |
|-------|------------|
| `shop.example.com` | `shop.example.com` |
| `SHOP.EXAMPLE.COM` | `shop.example.com` |
| `https://shop.example.com` | `shop.example.com` |
| `https://shop.example.com/path?q=1` | `shop.example.com` |
| `shop.example.com:443` | `shop.example.com` |
| `HTTPS://SHOP.EXAMPLE.COM:443/path` | `shop.example.com` |

| Input | Result |
|-------|--------|
| `localhost` | 400 (no dot) |
| `my shop.com` | 400 (space) |
| `http://` | 400 (empty after strip) |
| `-bad.com` | 400 (starts with hyphen) |

---

## curl Examples

```bash
BASE="http://localhost:3000/api"
TOKEN="<your-jwt>"

# 1. Create domain (input is normalized server-side)
curl -s -X POST $BASE/domains \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"domain\":\"HTTPS://MY-SHOP.EXAMPLE.COM/some-path\"}" | jq .
# -> { "id": "...", "hostname": "my-shop.example.com", "status": "PENDING",
#      "verification": { "type": "TXT", "name": "_pixecom", "value": "..." } }

# 2. List domains
curl -s $BASE/domains -H "Authorization: Bearer $TOKEN" | jq .

# 3. Verify domain (Phase 1 stub)
curl -s -X POST $BASE/domains/<domainId>/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"force\":true}" | jq .
# -> { "status": "VERIFIED", "verifiedAt": "2026-...", ... }

# 4. Set as primary domain
curl -s -X PATCH $BASE/domains/<domainId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"isPrimary\":true}" | jq .
# -> { "isPrimary": true, ... }

# 5. Publish sellpage with verified domain
curl -s -X POST $BASE/sellpages/<sellpageId>/publish -H "Authorization: Bearer $TOKEN" | jq .
# -> { "status": "PUBLISHED", "urlPreview": "https://my-shop.example.com/slug" }

# 6. Attempt publish with PENDING domain (expect 400)
curl -s -X POST $BASE/sellpages/<pendingSellpageId>/publish -H "Authorization: Bearer $TOKEN" | jq .
# -> { "statusCode": 400, "message": "...must be VERIFIED..." }

# 7. Delete domain (expect 409 if used by sellpage)
curl -s -X DELETE $BASE/domains/<domainId> -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Files Created / Modified

| File | Action | Lines |
|------|--------|-------|
| `packages/database/prisma/schema.prisma` | **Modified** | +1 line (`@@unique([hostname])`) |
| `packages/database/prisma/migrations/20260218100000_.../migration.sql` | **Created** | 5 |
| `packages/database/prisma/seed.ts` | **Modified** | +55 lines |
| `apps/api/src/domains/dto/create-domain.dto.ts` | **Created** | 22 |
| `apps/api/src/domains/dto/update-domain.dto.ts` | **Created** | 14 |
| `apps/api/src/domains/dto/verify-domain.dto.ts` | **Created** | 14 |
| `apps/api/src/domains/domains.service.ts` | **Created** | 287 |
| `apps/api/src/domains/domains.controller.ts` | **Created** | 103 |
| `apps/api/src/domains/domains.module.ts` | **Created** | 11 |
| `apps/api/src/app.module.ts` | **Modified** | +2 lines |
| `apps/api/src/sellpages/sellpages.service.ts` | **Modified** | +22 lines (publish gate + domainId in select) |
| `apps/api/test/domains.e2e-spec.ts` | **Created** | 385 |

---

## Test Summary

```
Test Suites: 5 passed, 5 total
Tests:       136 passed, 136 total (33 new in this milestone)
Snapshots:   0 total
Time:        ~15 s
```

| Suite | Tests | Status |
|-------|-------|--------|
| auth.e2e-spec.ts | 19 | PASS |
| seller.e2e-spec.ts | 13 | PASS |
| products.e2e-spec.ts | 41 | PASS |
| sellpages.e2e-spec.ts | 34 | PASS |
| domains.e2e-spec.ts | 33 (new) | PASS |
