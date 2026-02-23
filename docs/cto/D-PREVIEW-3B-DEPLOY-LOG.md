# D-PREVIEW-3B: Deploy to Cloudflare Pages

**Date**: 2026-02-23
**Branch**: `feature/2.4.2-alpha-ads-seed-v1`
**Commit**: `96a5cd1`

## Objective

Deploy the PixEcom v2 static preview frontend to Cloudflare Pages at `pixecom-preview.pages.dev` and set up custom domain `preview1.pixelxlab.com`.

## What Was Done

### 1. Build Setup
- Added `output: 'export'` and `images.unoptimized: true` to `next.config.js`
- Added `wrangler` and `@cloudflare/next-on-pages` as devDependencies
- Created `wrangler.toml` for CF Pages project `pixecom-preview`
- Added `pages:build` and `pages:deploy` scripts to `package.json`

### 2. Static Export Compatibility
- Split 12 dynamic routes into server wrapper (`page.tsx`) + client component (`_client.tsx`)
- Added `generateStaticParams()` to all dynamic routes for static HTML generation
- Routes split: 5 storefront, 5 portal, 2 admin

### 3. EnvGuard Fix
- `validateApiBase()` now skips validation when `NEXT_PUBLIC_PREVIEW_MODE=true`
- Preview builds no longer show "API Configuration Error" blocker

### 4. Build & Deploy
- Built with `NEXT_PUBLIC_PREVIEW_MODE=true npx next build`
- Output: 69 static pages, 208 files in `out/` directory
- Deployed via `npx wrangler pages deploy out --project-name=pixecom-preview`

### 5. Custom Domain
- Added `preview1.pixelxlab.com` to CF Pages project via API
- **Status: PENDING** — existing A record (VPS) needs to be replaced with CNAME
- PO action required: CF Dashboard > DNS > delete old A record for `preview1`

## Deployment URLs

| URL | Status |
|-----|--------|
| `https://pixecom-preview.pages.dev` | LIVE |
| `https://pixecom-preview.pages.dev/preview` | LIVE |
| `https://pixecom-preview.pages.dev/admin/dashboard` | LIVE |
| `https://pixecom-preview.pages.dev/demo-store` | LIVE |
| `https://preview1.pixelxlab.com` | PENDING DNS |

## Route Verification

All 12 key routes return HTTP 200:
- `/`, `/preview`
- `/admin/dashboard`, `/admin/sellers`, `/admin/orders`
- `/admin/sellers/sel_01`, `/admin/orders/ord_01`
- `/demo-store`, `/demo-store/lynsie-charm-bracelet`
- `/demo-store/lynsie-charm-bracelet/checkout`
- `/demo-store/pages/privacy`
- `/demo-store/trackings/search`

## Technical Notes

- `@cloudflare/next-on-pages` (deprecated) fails on Windows (`spawn npx ENOENT`)
- Used `output: 'export'` (full static) instead — no SSR needed for preview
- `'use client'` and `generateStaticParams` cannot coexist in same file — hence the server/client split pattern
- CF Pages serves `.html` files without extension automatically

## PO Action Required

To activate `preview1.pixelxlab.com`:
1. Cloudflare Dashboard > pixelxlab.com zone > DNS
2. Delete existing A record for `preview1` (points to VPS 143.198.24.81)
3. CF Pages will auto-create CNAME to `pixecom-preview.pages.dev`
4. SSL certificate will be provisioned automatically by Let's Encrypt
