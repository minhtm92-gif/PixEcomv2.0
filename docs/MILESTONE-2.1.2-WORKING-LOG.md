# PixEcom v2 — Milestone 2.1.2 Working Log
# Auth Module: JWT + Refresh Token Rotation

**Date:** February 18, 2026
**Branch:** `feature/2.1.2-auth-module` → commit `69eb38d`

**Objective:** Implement a complete email/password authentication system with JWT access tokens (15-min), refresh token rotation (7-day httpOnly cookie), full tenant bootstrapping on register (User + Seller + SellerUser + SellerSettings), and a Google SSO stub. 9/9 e2e tests passing.

---

## Scope of This Milestone

| Task | Description |
|------|-------------|
| Dependencies | Install `bcrypt`, `cookie-parser` + their types |
| DTOs | `RegisterDto`, `LoginDto` with class-validator |
| JWT Strategy | `passport-jwt` strategy validating `isActive` |
| Guard + Decorator | `JwtAuthGuard`, `@CurrentUser()` param decorator |
| AuthService | `register`, `login`, `refresh`, `logout`, `getMe`, `generateTokens` |
| AuthController | 6 endpoints: register, login, refresh, logout, me, google stub |
| AuthModule | `JwtModule` (async config), `PassportModule`, providers wired |
| App wiring | `cookie-parser` in `main.ts`, `AuthModule` in `AppModule` |
| Env vars | `JWT_EXPIRES_IN=15m`, `REFRESH_TOKEN_PEPPER`, `COOKIE_SECURE` |
| E2E tests | 9 tests across 4 describe blocks — all passing |

---

## Step 1: Create Feature Branch

```bash
git checkout -b feature/2.1.2-auth-module
```

**Result:** ✅ Branch created from `feature/2.1.1-migration-init-fix` HEAD

---

## Step 2: Install Missing Dependencies

```bash
# Runtime
pnpm --filter @pixecom/api add bcrypt cookie-parser

# Types (devDependencies)
pnpm --filter @pixecom/api add -D @types/bcrypt @types/cookie-parser

# E2E testing (devDependencies)
pnpm --filter @pixecom/api add -D supertest @types/supertest
```

**Already present — NOT re-installed:**
`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt`, `class-validator`, `class-transformer`

**Result:** ✅ 5 new packages added (bcrypt@6, cookie-parser, supertest + types)

---

## Step 3: Update Environment Variables

**Files updated:** `.env` (runtime) and `.env.example` (template)

```env
# Changed (was "1h"):
JWT_EXPIRES_IN="15m"

# New — pepper for HMAC-SHA256 refresh token hashing:
REFRESH_TOKEN_PEPPER="dev-pepper-change-in-prod-32ch!!"

# New — set "true" in Railway/production:
COOKIE_SECURE="false"
```

**Design decision:** `REFRESH_TOKEN_PEPPER` is a server-side secret mixed into the HMAC. Even if the `refresh_tokens` table leaks, an attacker cannot reconstruct the raw token value without the pepper. Pepper is stored only in the environment — never in the DB.

**Result:** ✅ Both `.env` files updated

---

## Step 4: Add `cookie-parser` to `main.ts`

**File:** `apps/api/src/main.ts`

```typescript
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());           // ← added: parses Cookie header → req.cookies
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ ... }));
  // ...
}
```

`cookie-parser` must be registered before NestJS route handlers so that `req.cookies.refresh_token` is populated when the `refresh` and `logout` endpoints read it.

**Result:** ✅ `main.ts` updated

---

## Step 5: Create DTOs

### `apps/api/src/auth/dto/register.dto.ts`

```typescript
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString() @MinLength(8) @MaxLength(72)
  password!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  displayName!: string;
}
```

### `apps/api/src/auth/dto/login.dto.ts`

```typescript
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString() @IsNotEmpty()
  password!: string;
}
```

**Design decisions:**
- `password` max 72 chars: bcrypt silently truncates inputs beyond 72 bytes. Enforcing this at the DTO level prevents a surprising discrepancy between what the user typed and what was hashed.
- `!` (definite assignment assertion): required because `tsconfig.base.json` has `strict: true` which enables `strictPropertyInitialization`. NestJS DTOs use class decorator + transformer injection — properties are set after construction.

**Result:** ✅ Both DTOs created

---

## Step 6: Create JWT Strategy

**File:** `apps/api/src/auth/strategies/jwt.strategy.ts`

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return { userId: payload.sub, sellerId: payload.sellerId, role: payload.role };
  }
}
```

**JWT payload shape:** `{ sub: userId, sellerId, role, iat, exp }`

**Design decisions:**
- `validate()` does a DB lookup on every protected request. This means immediately deactivating a user (setting `isActive=false`) will block their access token within one request. Without this check, a deactivated user's valid JWT would still work until expiry.
- `ignoreExpiration: false` — NestJS's Passport integration sets this to `true` by default in some versions. Explicit `false` is safer.

**Result:** ✅ JWT strategy created

---

## Step 7: Create Guard and Decorator

### `apps/api/src/auth/guards/jwt-auth.guard.ts`

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Thin wrapper that names the passport strategy (`'jwt'`). Applied to protected routes with `@UseGuards(JwtAuthGuard)`.

### `apps/api/src/auth/decorators/current-user.decorator.ts`

```typescript
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
```

Extracts `req.user` (injected by `JwtStrategy.validate()`) and makes it available as a controller method parameter via `@CurrentUser() user: AuthUser`.

**Result:** ✅ Guard and decorator created

---

## Step 8: Create AuthService

**File:** `apps/api/src/auth/auth.service.ts`

### Key method: `register(dto)`

1. Check email uniqueness (`findUnique` on `users.email`)
2. Hash password — `await bcrypt.hash(dto.password, 12)` (cost 12 = ~250ms on modern hardware)
3. Generate slug — `displayName` lowercased + special chars → dashes + 4-char random suffix
4. **Prisma `$transaction`**: create `User` + `Seller` + `SellerUser(OWNER)` + `SellerSettings` atomically
5. Call `generateTokens()` → return `AuthPayload`

**Why a transaction?** If any of the 4 creates fail (e.g. slug collision), the entire registration is rolled back. The user never ends up with a `User` row but no `Seller`, or a `Seller` with no `SellerSettings`.

### Key method: `generateTokens(userId, sellerId, role)`

```typescript
// 1. Sign JWT access token (15min)
const accessToken = this.jwt.sign({ sub: userId, sellerId, role }, { expiresIn: '15m' });

// 2. Generate raw refresh token
const rawRefreshToken = crypto.randomBytes(48).toString('hex');  // 96 hex chars

// 3. Hash with HMAC-SHA256 + PEPPER
const hash = crypto.createHmac('sha256', PEPPER).update(rawRefreshToken).digest('hex');  // 64 hex chars

// 4. Persist hash (NOT raw) to DB
await prisma.refreshToken.create({ data: { userId, token: hash, expiresAt: now+7d } });

// 5. Return raw to caller (controller sets it in the cookie)
return { accessToken, rawRefreshToken };
```

**Why store a hash?** The `refresh_tokens` table stores only the hash. Even if the database is read by an attacker, they cannot use the hash values directly — they need the original raw token + the server-side `PEPPER`. This is the same principle as storing password hashes instead of plaintext passwords.

**Why HMAC-SHA256 (not bcrypt) for refresh tokens?** Refresh tokens are long random strings (96 hex chars = 384 bits of entropy). bcrypt is expensive by design to slow down brute-force attacks on short human-chosen passwords. With 384 bits of entropy there is no meaningful brute-force surface — HMAC-SHA256 is fast enough to be called on every request without the 250ms overhead of bcrypt.

### Key method: `refresh(rawToken)`

```typescript
1. Hash incoming raw token → look up in DB
2. If not found → 401 (token invalid or already used)
3. If found but expired → delete row + 401
4. If user.isActive is false → 401
5. DELETE old refresh token row   ← rotation: old token is now dead
6. generateTokens() → new access + new raw refresh
7. Return new pair
```

**Rotation security:** After a single use, the old refresh token is permanently deleted. If an attacker steals a refresh token and uses it after the legitimate user already refreshed, the attacker's attempt returns 401. On a stricter implementation, detecting a "used" token could trigger account lock — this is left as a Phase 2 improvement.

### Key method: `logout(rawToken)`

```typescript
const hash = hashToken(rawToken);
await prisma.refreshToken.deleteMany({ where: { token: hash } });
```

Uses `deleteMany` (not `delete`) so if the token doesn't exist (already expired/rotated), the operation is silent — no error thrown. The cookie is always cleared.

**Result:** ✅ AuthService created (290 lines)

---

## Step 9: Create AuthController

**File:** `apps/api/src/auth/auth.controller.ts`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `POST /api/auth/register` | 201 | None | Create User+Seller+SellerUser+SellerSettings, set cookie |
| `POST /api/auth/login` | 200 | None | Verify credentials, set cookie |
| `POST /api/auth/refresh` | 200 | Cookie | Rotate refresh token, set new cookie |
| `POST /api/auth/logout` | 200 | Cookie (optional) | Revoke token, clear cookie |
| `GET /api/auth/me` | 200 | JWT Bearer | Return user + seller context |
| `POST /api/auth/google` | 501 | None | Stub — not implemented |

**Cookie path:** `path: '/api/auth/refresh'` — cookie is only sent by the browser to that exact path, not every API request. This limits the attack surface compared to `path: '/'`.

**`@Res({ passthrough: false })`:** Used on register/login/refresh/logout because we call `res.cookie()` and `res.status().json()` manually. NestJS's default `passthrough: true` auto-sends the return value — turning it off prevents a double-response conflict.

**Result:** ✅ AuthController created — 6 endpoints registered

---

## Step 10: Create AuthModule + Update AppModule

### `apps/api/src/auth/auth.module.ts`

```typescript
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

**Why `JwtModule.registerAsync()`?** The JWT secret comes from `ConfigService` (environment variables). `registerAsync` delays configuration until after `ConfigModule` has loaded the `.env` file. Using the static `register({ secret: 'literal' })` would hardcode the secret.

**Why no `PrismaModule` import?** `PrismaModule` is `@Global()` — it's available to `AuthModule` automatically.

### `apps/api/src/app.module.ts` (updated)

```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
  PrismaModule,
  HealthModule,
  AuthModule,    // ← added
],
```

**Result:** ✅ AuthModule created + AppModule updated

---

## Step 11: Build

```bash
pnpm --filter @pixecom/api build
```

**Initial errors:**
```
TS2564: Property 'email' has no initializer and is not definitely assigned in the constructor.
```
5 errors across both DTOs. Root cause: `strict: true` in `tsconfig.base.json` enables `strictPropertyInitialization`. NestJS DTOs must use `!` (definite assignment assertion) because their properties are set by the validation pipeline, not the constructor.

**Fix:** Added `!` to all DTO properties:
```typescript
email!: string;   // was: email: string;
```

**Final build:**
```
(exit 0, no output) ← clean compile
```

**Result:** ✅ Build clean after DTO fix

---

## Step 12: Write E2E Tests

**File:** `apps/api/test/auth.e2e-spec.ts`

Tests use `@nestjs/testing` + `supertest` against the live `pixecom-postgres` container. Each test run generates unique emails via `test-${Date.now()}-${random}@pixecom-e2e.io` to avoid conflicts.

### Test 1: Register → GET /me

```
1. POST /api/auth/register → expect 201 + accessToken + user + seller
2. Check Set-Cookie header contains refresh_token=...
3. GET /api/auth/me with Bearer token → expect 200 + email + sellerId + role:OWNER
4. GET /api/auth/me with no token → expect 401
```

### Test 2: Login → Refresh rotates token (old rejected)

```
1. Register + login → capture cookie T1
2. POST /api/auth/refresh with T1 → get new accessToken + cookie T2
3. POST /api/auth/refresh with OLD T1 → expect 401  ← rotation verified
4. POST /api/auth/refresh with T2 → expect 200  ← new token still valid
```

### Test 3: Logout → Refresh rejected

```
1. Register + login → capture cookie
2. POST /api/auth/logout → expect 200 + { message: "Logged out" }
3. POST /api/auth/refresh with same cookie → expect 401  ← revocation verified
```

### Input Validation

```
4. Register short password (7 chars) → expect 400
5. Register invalid email → expect 400
6. Register duplicate email → expect 409
7. POST /api/auth/google → expect 501
```

**E2E test run results:**

```
PASS test/auth.e2e-spec.ts (5.868 s)
  Auth (e2e)
    Test 1: Register then GET /me
      ✓ should register a new seller and return valid access token (400 ms)
      ✓ should allow GET /me with a valid access token (317 ms)
      ✓ should reject GET /me with no token (401) (5 ms)
    Test 2: Login → Refresh rotates token
      ✓ should rotate refresh token on refresh and reject old token (613 ms)
    Test 3: Logout → Refresh rejected
      ✓ should invalidate refresh token on logout (564 ms)
    Input validation
      ✓ should reject register with short password (400) (5 ms)
      ✓ should reject register with invalid email (400) (4 ms)
      ✓ should reject duplicate email registration (409) (313 ms)
      ✓ should return 501 for Google SSO stub (4 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Time:        6.129 s
```

**Result:** ✅ 9/9 tests passing

---

## Step 13: Manual Smoke Verification

**API started:** `cd apps/api && PORT=3002 pnpm start` (3001 occupied by e2e run)

**Startup log:**
```
[NestFactory]    Starting Nest application...
[InstanceLoader]  PrismaModule dependencies initialized
[InstanceLoader]  PassportModule dependencies initialized
[InstanceLoader]  JwtModule dependencies initialized
[InstanceLoader]  AuthModule dependencies initialized
[RouterExplorer]  Mapped {/api/auth/register, POST} route
[RouterExplorer]  Mapped {/api/auth/login, POST} route
[RouterExplorer]  Mapped {/api/auth/refresh, POST} route
[RouterExplorer]  Mapped {/api/auth/logout, POST} route
[RouterExplorer]  Mapped {/api/auth/me, GET} route
[RouterExplorer]  Mapped {/api/auth/google, POST} route
[PrismaService]   Database connected
[NestApplication] Nest application successfully started
PixEcom API running on http://localhost:3002
```

**Register:**
```json
{
  "accessToken": "eyJhbGci...VdcUJGS5...",
  "user": {
    "id": "7bc719d1-bbb4-43d4-aa72-5261bcfd42d4",
    "email": "smoke1771399671@test.io",
    "displayName": "SmokeSeller"
  },
  "seller": {
    "id": "279c21b1-c6df-4c84-9f22-5605c9dae08b",
    "name": "SmokeSeller",
    "slug": "smokeseller-zz4q"
  }
}
```

**GET /me (Bearer token):**
```json
{
  "id": "7bc719d1-bbb4-43d4-aa72-5261bcfd42d4",
  "email": "smoke1771399671@test.io",
  "displayName": "SmokeSeller",
  "avatarUrl": null,
  "sellerId": "279c21b1-c6df-4c84-9f22-5605c9dae08b",
  "role": "OWNER"
}
```

**Refresh:** → 200 + new `accessToken`

**Google stub:** → `{"statusCode":501,"message":"Google SSO not yet implemented"}`

**Result:** ✅ All endpoints verified manually

---

## Step 14: Commit and Push

```bash
git add apps/api/src/auth/ apps/api/test/auth.e2e-spec.ts \
        apps/api/src/main.ts apps/api/src/app.module.ts \
        apps/api/package.json .env.example pnpm-lock.yaml

git commit -m "feat(auth): milestone 2.1.2 — auth module with JWT + refresh rotation"
# → [feature/2.1.2-auth-module 69eb38d]
# → 14 files changed, 1027 insertions(+), 2 deletions(-)

git push origin feature/2.1.2-auth-module
# → * [new branch] feature/2.1.2-auth-module -> feature/2.1.2-auth-module
```

**GitHub PR:** https://github.com/minhtm92-gif/PixEcomv2.0/pull/new/feature/2.1.2-auth-module

**Result:** ✅ Committed and pushed

---

## Problems Encountered & Resolutions

### Problem 1: TS2564 — Strict Property Initialization on DTOs

**Symptom:**
```
error TS2564: Property 'email' has no initializer and is not definitely assigned in the constructor.
```
5 errors across `register.dto.ts` and `login.dto.ts`.

**Root cause:** `tsconfig.base.json` enables `strict: true` which includes `strictPropertyInitialization`. NestJS DTOs don't use a constructor to assign properties — the `ValidationPipe` and `class-transformer` set them after instantiation. TypeScript can't see this and flags all uninitialized properties.

**Resolution:** Added the `!` definite assignment assertion to all DTO properties:
```typescript
email!: string;    // tells TypeScript: "trust me, this will be set"
```

This is the standard NestJS pattern with `strict` mode. Alternatively, `strictPropertyInitialization: false` in tsconfig would suppress all such errors project-wide, but the per-property `!` is more precise.

---

### Problem 2: `import * as request from 'supertest'` Type Error

**Symptom:**
```
error TS2349: This expression is not callable.
Type '{ default: SuperTestStatic; ... }' has no call signatures.
```

**Root cause:** `supertest` is an ES module with a default export. `import * as request` creates a namespace object — calling `request(...)` tries to invoke the namespace itself, which has no call signature. TypeScript (with `esModuleInterop: true`) correctly rejects this.

**Resolution:** Changed to default import:
```typescript
import request from 'supertest';   // was: import * as request from 'supertest'
```

---

### Problem 3: `headers['set-cookie'] as string[]` Type Error

**Symptom:**
```
error TS2352: Conversion of type 'string' to type 'string[]' may be a mistake
```

**Root cause:** The `supertest` response header type signature for `set-cookie` returns `string` (single cookie string), not `string[]`. However at runtime it returns an array.

**Resolution:** Used double cast through `unknown`:
```typescript
const cookies = res.headers['set-cookie'] as unknown as string[];
```
This tells TypeScript "I know better" while preserving the runtime array behavior.

---

### Problem 4: Port 3001 EADDRINUSE on Manual Smoke Test

**Symptom:** Starting `pnpm start` while e2e test process was still running → `Error: listen EADDRINUSE :::3001`

**Resolution:** Used `PORT=3002` for the manual smoke test run. Not a real problem — port is freed once e2e tests complete.

---

## Architecture Notes

### Refresh Token Lifecycle

```
Register/Login
    │
    ├─ generateTokens(userId, sellerId, role)
    │       ├─ jwt.sign(...) → accessToken (15min)
    │       ├─ crypto.randomBytes(48) → rawRefreshToken (96 hex chars)
    │       ├─ HMAC-SHA256(PEPPER, rawRefreshToken) → hash (64 hex chars)
    │       ├─ INSERT refresh_tokens(userId, token=hash, expiresAt=now+7d)
    │       └─ return { accessToken, rawRefreshToken }
    │
    └─ setRefreshCookie(res, rawRefreshToken)
            └─ res.cookie('refresh_token', raw, { httpOnly, path:/api/auth/refresh, maxAge:7d })

POST /api/auth/refresh (cookie: rawRefreshToken)
    ├─ hash incoming → findUnique(token=hash)
    ├─ check expiry
    ├─ DELETE old row       ← rotation
    └─ generateTokens() → new pair → new cookie

POST /api/auth/logout (cookie: rawRefreshToken)
    ├─ hash incoming → deleteMany(token=hash)
    └─ clearCookie()
```

### Tenant Bootstrapping on Register

```
$transaction {
  User.create({ email, passwordHash, displayName })
  Seller.create({ name: displayName, slug })
  SellerUser.create({ userId, sellerId, role: 'OWNER' })
  SellerSettings.create({ sellerId })
}
```

Every registered user immediately has a Seller account (with OWNER role) and minimal SellerSettings. This is the "one seller per registration" model for Phase 1. Multi-seller onboarding (invite flow) comes later.

### Security Decisions Summary

| Decision | Choice | Reason |
|---|---|---|
| Password hashing | bcrypt cost 12 | ~250ms per hash — strong against brute force |
| Refresh token entropy | `randomBytes(48)` = 384 bits | Astronomically large — no brute-force surface |
| Refresh token storage | SHA-256+PEPPER hash in DB | DB leak does not expose usable tokens |
| Cookie `path` | `/api/auth/refresh` | Not sent on every API request — minimizes exposure |
| Cookie `sameSite` | `lax` | Allows top-level navigation while blocking CSRF |
| Cookie `secure` | Env-controlled (`COOKIE_SECURE`) | `false` for local dev, `true` for Railway/prod |
| JWT expiry | 15 minutes | Short window limits damage if access token is intercepted |
| Refresh rotation | Delete-on-use | Prevents replay attacks with stolen tokens |

---

## Final State

### API Routes Registered

```
[RouterExplorer] Mapped {/api/auth/register, POST}
[RouterExplorer] Mapped {/api/auth/login, POST}
[RouterExplorer] Mapped {/api/auth/refresh, POST}
[RouterExplorer] Mapped {/api/auth/logout, POST}
[RouterExplorer] Mapped {/api/auth/me, GET}
[RouterExplorer] Mapped {/api/auth/google, POST}
```

### File Tree — Net Changes

```
apps/api/src/auth/
├── auth.module.ts                       ← NEW
├── auth.controller.ts                   ← NEW
├── auth.service.ts                      ← NEW
├── dto/
│   ├── register.dto.ts                  ← NEW
│   └── login.dto.ts                     ← NEW
├── strategies/
│   └── jwt.strategy.ts                  ← NEW
├── guards/
│   └── jwt-auth.guard.ts                ← NEW
└── decorators/
    └── current-user.decorator.ts        ← NEW

apps/api/test/
└── auth.e2e-spec.ts                     ← NEW (9 tests)

apps/api/src/main.ts                     ← MODIFIED (cookie-parser)
apps/api/src/app.module.ts               ← MODIFIED (AuthModule added)
apps/api/package.json                    ← MODIFIED (bcrypt, cookie-parser, supertest)
.env.example                             ← MODIFIED (JWT_EXPIRES_IN=15m, PEPPER, COOKIE_SECURE)
pnpm-lock.yaml                           ← MODIFIED (lockfile updated)

docs/
└── MILESTONE-2.1.2-WORKING-LOG.md       ← this file
```

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Time:        6.129 s
```

---

## Next Milestone: 2.1.3 — Seller Module

- `GET /api/sellers/me` — current seller profile
- `PATCH /api/sellers/me` — update seller name, logoUrl
- `GET /api/sellers/me/settings` — SellerSettings read
- `PATCH /api/sellers/me/settings` — update SellerSettings
- All endpoints behind `JwtAuthGuard`
- `seller_id` scoping enforced on all queries
