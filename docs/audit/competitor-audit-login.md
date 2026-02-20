# Competitor Audit: Login Page
**Source:** Selles system screenshot (`login.jfif`)
**Date:** 2026-02-20
**Auditor:** CTO Advisor + Product Owner

---

## 1. SCREENSHOT ANALYSIS

### Page Layout

| Element | Description |
|---------|------------|
| **Background** | Light mint/teal gradient |
| **Logo (Selles)** | Selles logo (teal arrow icon + "SELLESS" text) |
| **Subtitle (Selles)** | "Seller Portal for Selless Platform" |
| **PixEcom Logo** | **PixelxLab** — 3 pixel squares icon (dark navy + medium blue + light blue) + "PixelxLab" text (dark, bold) + "E-COMMERCE" subtitle (blue, spaced) |
| **Logo file** | `Logo.png` — source: `D:\Pixel Team\NEW-PixEcom\General Plan\PixEcom Screenshot\Logo.png` |
| **Card** | White card centered on page |
| **Footer** | "Selless © Copyright 2026" |

### Sign In Form

| Element | Type | Description |
|---------|------|------------|
| **Title** | Text | "Sign in to your account" |
| **Continue with Google** | Button | Google OAuth — G icon + text |
| **OR** | Divider | Separator between OAuth and email login |
| **Email** | Input | "Enter your email" placeholder, person icon |
| **Password** | Input | Password dots (masked), key icon |
| **Sign in** | Button | Teal/green button, full width |
| **Sign Up** | Link | "Don't have an account? Sign Up" |
| **Forgot password?** | Link | Teal text link |

---

## 1B. PIXECOM BRANDING — LOGO SPEC

### Logo Details

| Property | Value |
|----------|-------|
| **Brand name** | PixelxLab |
| **Tagline** | E-COMMERCE |
| **Icon** | 3 pixel squares arranged in cross/plus pattern: dark navy (#1a1a4e), medium blue (#5b5bd6), light blue (#4dc9f6) |
| **Text style** | "PixelxLab" — bold, dark/black, sans-serif. "E-COMMERCE" — medium blue, letter-spaced, smaller |
| **File** | `Logo.png` (high-res, white background) |
| **Usage** | Login page header, sidebar top, favicon (pixel squares only) |

### Branding for Login Page

```
┌─────────────────────────────────────┐
│                                     │
│    ■ ·  PixelxLab                   │
│    · ■  E-COMMERCE                  │
│                                     │
│    Seller Portal for PixelxLab      │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Sign in to your account      │  │
│  │                               │  │
│  │  [Continue with Google]       │  │
│  │  ──── OR ────                 │  │
│  │  [Enter your email      ]    │  │
│  │  [••••••••••••          ]    │  │
│  │  [       Sign in        ]    │  │
│  │                               │  │
│  │  Don't have an account? Sign Up  │
│  │  Forgot password?             │  │
│  └───────────────────────────────┘  │
│                                     │
│  PixelxLab © Copyright 2026         │
└─────────────────────────────────────┘
```

### Frontend Implementation Note

**✅ DECISION: Dùng SVG cho logo** — cho phép switch light/dark mode bằng CSS variables, không cần designer export thêm file.

```
apps/web/src/components/
  Logo.tsx            ← SVG component, dùng CSS vars cho text color
  LogoIcon.tsx        ← SVG icon only (3 pixel squares)

apps/web/public/
  logo.png            ← PNG fallback (light mode, trimmed)
  favicon.svg         ← SVG favicon (icon only)
  favicon.ico         ← ICO fallback
```

#### SVG Logo Component Spec

```tsx
// Logo.tsx — simplified concept
// Icon colors: FIXED (không đổi theo theme)
//   Dark navy square:  #1B1F3B
//   Medium blue square: #6C63FF
//   Light blue square:  #4DC9F6
//
// Text colors: SWITCH theo theme via CSS variables
//   Light mode: "PixelxLab" = #1B1F3B (dark), "E-COMMERCE" = #6C63FF (blue)
//   Dark mode:  "PixelxLab" = #FFFFFF (white), "E-COMMERCE" = #8B83FF (lighter blue)
```

> **⚠️ NOTE cho Dev:**
> 1. File `Logo.png` gốc có **rất nhiều whitespace/padding trống** xung quanh. Cần **crop/trim hết phần trống** trước khi dùng cho PNG fallback.
> 2. Convert logo sang **SVG inline component** — trace từ PNG hoặc recreate (logo đơn giản: 3 squares + text).
> 3. Icon (3 pixel squares) giữ nguyên màu cả light/dark — đủ contrast trên cả 2 nền.
> 4. Chỉ đổi màu text "PixelxLab" (dark↔white) và "E-COMMERCE" (adjust blue shade) theo theme.
> 5. Export favicon từ icon only (3 squares), size 32x32 + 16x16.

---

## 2. GAP ANALYSIS — PixEcom v2 vs Selles

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Email + Password login** | ✅ | ✅ JWT auth with bcrypt(12) | OK |
| **Google OAuth** | ✅ "Continue with Google" | ❌ No OAuth | **NEW: Google OAuth integration** |
| **Sign Up flow** | ✅ "Sign Up" link | ❌ No registration endpoint (superadmin creates users) | **Depends on business model** |
| **Forgot password** | ✅ Link visible | ❌ No password reset flow | **NEW: Password reset** |
| **Branded login page** | ✅ Logo + subtitle + styled card | ❌ Frontend is all mock data | Frontend |
| **Refresh token** | ? | ✅ Refresh token rotation exists | OK |

---

## 3. REQUIRED CHANGES FOR TECH LEAD

### 3.1 Google OAuth (P1)

**Endpoint:** `POST /api/auth/google`
**Body:**
```json
{
  "idToken": "google-id-token-from-frontend"
}
```
**Business Logic:**
1. Verify Google ID token via Google API
2. Extract email from token
3. Find User by email
4. If exists → issue JWT + refresh token (same as current login)
5. If not exists → depends on business model:
   - **Option A (Invite-only):** Return error "Account not found. Contact admin."
   - **Option B (Self-service):** Auto-create User + Seller → issue tokens

**Dependencies:** `google-auth-library` npm package
**Effort:** 2 days

### 3.2 Password Reset (P1)

**Endpoints:**
- `POST /api/auth/forgot-password` — Send reset email
- `POST /api/auth/reset-password` — Set new password with token

**Business Logic:**
1. Generate reset token (crypto.randomBytes) + expiry (1 hour)
2. Store token hash in User record (new field: `resetTokenHash`, `resetTokenExpiry`)
3. Send email with reset link
4. On reset: validate token, hash new password, clear token

**Dependencies:** Email service (SendGrid/SES/etc.)
**Effort:** 2 days

### 3.3 Schema Changes

```prisma
model User {
  // ... existing fields ...
  resetTokenHash    String?   @map("reset_token_hash") @db.VarChar(255)
  resetTokenExpiry  DateTime? @map("reset_token_expiry") @db.Timestamptz
  googleId          String?   @map("google_id") @db.VarChar(255)

  @@unique([googleId])
}
```

---

## 4. PRIORITY & EFFORT

| Item | Effort | Priority |
|------|--------|----------|
| Google OAuth | 2 days | P1 (nice to have for UX, not blocking) |
| Password reset flow | 2 days | P1 (important for production) |
| Self-service registration | 3 days | P2 (depends on business model — invite-only or open) |
| Branded login page (frontend) | 1 day | P2 |

**Total: ~4 dev days (P1) + 4 dev days (P2)**

---

## 5. OWNER NOTES

> Login page của Selles khá standard. Gap chính là:
> 1. **Google OAuth** — convenient nhưng không blocking
> 2. **Password reset** — cần có cho production
> 3. **Self-service sign up** — tùy business model. Nếu invite-only (platform mời seller) thì không cần. Nếu open marketplace thì cần.
>
> **Hiện tại PixEcom v2 auth flow OK cho internal use** — JWT + refresh token + bcrypt đủ secure. Chỉ thiếu Google OAuth và password reset cho production readiness.

---

*End of competitor screenshot audit series*
