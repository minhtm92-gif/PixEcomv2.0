# PixEcom v2 — R2 + CDN Infrastructure Setup Working Log

**Date:** February 18, 2026
**Objective:** Set up Cloudflare R2 object storage + CDN for media asset delivery
**Domain:** pixelxlab.com | CDN subdomain: cdn.pixelxlab.com

---

## Step 1: Enable Cloudflare R2

**Action:** Attempted to list R2 buckets via Cloudflare API → got HTTP 403 error: *"Please enable R2 through the Cloudflare Dashboard."*

**Resolution:** User manually enabled R2 in the Cloudflare Dashboard (requires adding a payment method — credit card or PayPal).

**Result:** ✅ R2 enabled on account `6717d31aca96c6a5493e3d58e651d861`

---

## Step 2: Add Domain to Cloudflare DNS

**Problem:** `pixelxlab.com` was not on Cloudflare DNS — required for R2 custom domain feature.

**Action:** User added `pixelxlab.com` to Cloudflare and updated nameservers at their registrar to:
- `phoenix.ns.cloudflare.com`
- `steven.ns.cloudflare.com`

**Verification:** Cloudflare Dashboard → Overview → shows green checkmark: *"Your domain is now protected by Cloudflare"*
- DNS Setup: **Full**
- Zone status: **Active**

**Result:** ✅ Domain active on Cloudflare (Free plan)

---

## Step 3: Create R2 Bucket

**Action:** Created bucket via Cloudflare MCP tool:
```
Name: pixecom-assets
Location: Eastern North America (ENAM)
Default Storage Class: Standard
```

**Verification:** Bucket visible in Cloudflare Dashboard → R2 Object Storage → pixecom-assets

**Result:** ✅ Bucket `pixecom-assets` created

---

## Step 4: Configure Custom Domain `cdn.pixelxlab.com`

**Action:** In R2 bucket Settings → Custom Domains → clicked "+ Add":
- Entered domain: `cdn.pixelxlab.com`
- Cloudflare auto-created an R2-type DNS record: `cdn.pixelxlab.com → pixecom-assets` (Proxied, TTL Auto)

**Verification:**
- R2 Settings page → Custom Domains table:
  - Domain: `cdn.pixelxlab.com`
  - Minimum TLS: 1.0
  - Status: **Active** ✅
  - Access: **Enabled** ✅
- DNS Records page → shows R2 record: `cdn.pixelxlab.com → pixecom-assets` (Proxied)

**Additional settings confirmed:**
- Public Development URL (r2.dev): **Disabled** (security best practice — no public r2.dev access)

**Result:** ✅ Custom domain connected and active

---

## Step 5: Set CORS Policy

**Action:** In R2 bucket Settings → CORS Policy → Edit CORS policy. Entered the following JSON in the code editor:

```json
[
  {
    "AllowedOrigins": [
      "https://pixelxlab.com",
      "https://*.pixelxlab.com",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Length",
      "x-amz-content-sha256"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

**Note:** Initial attempt with multi-line typing in the Monaco editor failed with validation errors. Fixed by clearing the editor (Ctrl+A → Backspace) and entering as compact single-line JSON.

**Result:** ✅ CORS policy saved successfully

---

## Step 6: Upload Test File

**Action:**
1. Created a placeholder image using PowerShell `System.Drawing`:
   - 400x400px grey background with "No Image" text
   - Saved as `C:\Users\ADMIN\Desktop\no-image.jpg` (5,700 bytes)

2. Created directory structure in R2 bucket:
   - `system/` directory (via Add Directory button)
   - `system/defaults/` subdirectory (navigated into system/, then Add Directory)

3. Uploaded file via JavaScript DataTransfer API on the Cloudflare Dashboard:
   - Generated canvas-based image in browser
   - Set on hidden file input element using `DataTransfer` API
   - Dispatched `change` event to trigger upload

**Verification:** File visible in bucket:
```
Path: pixecom-assets / system / defaults / no-image.jpg
Type: image/jpeg
Storage Class: Standard
Size: 2.76 KB
Modified: 18 Feb 2026 12:35:55 GMT+7
```

**Result:** ✅ Test file uploaded at `system/defaults/no-image.jpg`

---

## Step 7: Create R2 API Token

**Action:** Navigated to R2 Object Storage → API Tokens → Create Account API Token:

```
Token name:    pixecom-api-token
Permission:    Object Read & Write
               (read, write, and list objects in specific buckets)
Bucket scope:  Apply to specific buckets only → pixecom-assets
TTL:           Forever
IP Filtering:  None (all addresses)
```

**Why Account API Token (not User API Token):** Account tokens remain active even if the user leaves the organization — ideal for production backend services.

**Credentials generated:**
```
Token value:       YYqUckD8M9E3bhxD81glqMfTwoln4qzeOpvCgrPW
Access Key ID:     b8ddf55bcc8f9e853ae2493ac6764926
Secret Access Key: d13d5865bc45d9f043f799281da9c7980a8a9b9f693bbb3b654a1f9645277279
S3 Endpoint:       https://6717d31aca96c6a5493e3d58e651d861.r2.cloudflarestorage.com
```

**Result:** ✅ API token created (credentials shown once — saved by user)

---

## Step 8: Update `.env.example`

**Action:** Added R2 configuration section to `pixecom-v2/.env.example`:

```env
# ─── Cloudflare R2 (Object Storage) ────────────────
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="pixecom-assets"
R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
CDN_BASE_URL="https://cdn.pixelxlab.com"
```

**Note:** Placeholder values used in `.env.example` (git-tracked). Real credentials go in `.env` (git-ignored).

**Result:** ✅ `.env.example` updated

---

## Step 9: SSL Certificate Validation

**Issue:** CDN URL `https://cdn.pixelxlab.com/system/defaults/no-image.jpg` initially returned **HTTP 503** (Service Unavailable).

**Root cause:** SSL/TLS → Edge Certificates showed:
```
Hosts:    *.pixelxlab.com, pixelxlab.com
Type:     Universal
Status:   Pending Validation (TXT)
```

The ACME challenge TXT record (`_acme-challenge.pixelxlab.com`) needed validation. Cloudflare message: *"Cloudflare will validate the certificate on your behalf. No action is required."*

**Why no action was needed:** Since nameservers already point to Cloudflare, they handle the ACME DNS challenge automatically.

**SSL/TLS encryption mode:** Full (correct for R2 custom domains)

**Resolution:** Certificate was auto-validated by Cloudflare within ~30 minutes. No manual intervention required.

**Result:** ✅ SSL certificate issued and active

---

## Step 10: CDN Delivery Verification (All Passed)

Verified on: February 18, 2026, ~13:18 GMT+7

### URL Checks

| # | Test | URL | Expected | Actual | Status |
|---|------|-----|----------|--------|--------|
| 1 | CDN delivers file | `https://cdn.pixelxlab.com/system/defaults/no-image.jpg` | HTTP 200 + image | **200** — renders 400x400 "No Image" placeholder | ✅ PASS |
| 2 | Root no directory listing | `https://cdn.pixelxlab.com/` | 403/404 | **404 Object not found** — no listing exposed | ✅ PASS |
| 3 | Missing file returns 404 | `https://cdn.pixelxlab.com/nonexistent.jpg` | HTTP 404 | **404 Object not found** | ✅ PASS |

### Cache Headers (fetched via JavaScript `fetch()`)

```
cf-cache-status:  HIT              ✅ Cloudflare CDN cache is working
cache-control:    max-age=14400       (4 hours default TTL)
age:              145                 (served from cache, 145 seconds old)
content-type:     image/jpeg       ✅ Correct MIME type
content-length:   2758                (2.76 KB matches uploaded file)
etag:             "28405096abfe6dd2f6fda03ffc2e2213"  (object fingerprint)
server:           cloudflare       ✅ Served through Cloudflare edge
cf-ray:           9cfb68cbb96b097c-HKG  (served from Hong Kong POP)
last-modified:    Wed, 18 Feb 2026 05:35:55 GMT
accept-ranges:    bytes
vary:             Accept-Encoding
```

### Security Checks

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| r2.dev public URL | Disabled | Disabled in R2 Settings | ✅ PASS |
| No directory listing at root | 403/404 | 404 — no bucket contents exposed | ✅ PASS |
| HTTPS enforced | SSL active | Universal cert active, Full encryption mode | ✅ PASS |
| CDN caching | cf-cache-status present | `HIT` on subsequent requests | ✅ PASS |

---

## Final Environment Variables for `.env`

```env
R2_ACCOUNT_ID="6717d31aca96c6a5493e3d58e651d861"
R2_ACCESS_KEY_ID="b8ddf55bcc8f9e853ae2493ac6764926"
R2_SECRET_ACCESS_KEY="d13d5865bc45d9f043f799281da9c7980a8a9b9f693bbb3b654a1f9645277279"
R2_BUCKET_NAME="pixecom-assets"
R2_ENDPOINT="https://6717d31aca96c6a5493e3d58e651d861.r2.cloudflarestorage.com"
CDN_BASE_URL="https://cdn.pixelxlab.com"
```

---

## Architecture Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage provider | Cloudflare R2 | S3-compatible, zero egress fees, pairs with CF CDN |
| Bucket name | `pixecom-assets` | Clear project identifier |
| CDN domain | `cdn.pixelxlab.com` | Permanent subdomain, easy to migrate if needed |
| DB stores | Relative keys only | e.g. `products/{id}/media/v1.mp4` — API prepends `CDN_BASE_URL` at response time |
| Upload method | Presigned URLs (admin-only) | Backend generates S3 presigned PUT URL, admin uploads directly to R2 |
| Token type | Account API Token | Survives user changes, recommended for production |
| Token scope | Object R&W, pixecom-assets only | Least-privilege: no admin/bucket management access |
| Public r2.dev | Disabled | All access goes through `cdn.pixelxlab.com` only |
| CORS origins | pixelxlab.com, *.pixelxlab.com, localhost:3000/3001 | Production + dev environments |
