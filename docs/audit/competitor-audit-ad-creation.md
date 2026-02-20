# Competitor Audit: Create New Facebook Ad (5-Step Flow)
**Source:** Selles system screenshots (`Create New FB Ad Step 1.jfif`, `Step 1.1.jfif`, `Step2.jfif`, `Step2.1.jfif`, `Step2.2.jfif`)
**Date:** 2026-02-20
**Auditor:** CTO Advisor + Product Owner

---

## 0. FLOW OVERVIEW

Ad creation trong Selles là **2-step wizard** (modal dialog), mỗi step có nhiều sub-sections:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ENTRY POINTS:                                              │
│  ─ Sellpage List → "Create New Ad" button (beside Post ID) │
│  ─ Product → Ad Content tab → "Create New Facebook Ad"     │
│  ─ Sellpage Detail → general CTA                           │
│                                                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                             │
│  STEP 1 (Step 1 + Step 1.1 screenshots):                   │
│  ┌──────────────────────────────────────┐                   │
│  │ 1A. Facebook Ad Strategy (dropdown)  │                   │
│  │ 1B. Sellpage (dropdown, pre-filled)  │                   │
│  │ 1C. Sellpage Ad Configuration:       │                   │
│  │     - Facebook Page (auto-loaded)    │                   │
│  │     - Ad Account (dropdown)          │                   │
│  │     - Pixel (dropdown)               │                   │
│  │     - Conversion (dropdown)          │                   │
│  │ ─ ─ ─ ─ (after strategy selected) ─  │                   │
│  │ 1D. Campaign Configuration:          │                   │
│  │     - Number of Campaigns            │                   │
│  │     - Duplicate Post ID checkbox     │                   │
│  │     - Budget per Campaign            │                   │
│  │     - Budget Type (DAILY)            │                   │
│  │ 1E. Campaign Status (Active/Pause)   │                   │
│  │ 1F. Start/End Time (optional)        │                   │
│  │ 1G. Ad Set Configuration:            │                   │
│  │     - Number of Ads/Adset            │                   │
│  │     - Optimization Goal              │                   │
│  │ 1H. Attribution Model + Windows:     │                   │
│  │     - Click-through: 1 day           │                   │
│  │     - Engaged-view: None             │                   │
│  │     - View-through: None             │                   │
│  │ 1I. Audience:                        │                   │
│  │     - Advantage+ / Original          │                   │
│  │     - Location, Gender, Age, Language │                   │
│  │     - Minimum Age                    │                   │
│  │                          [Cancel][Next]                  │
│  └──────────────────────────────────────┘                   │
│                          │                                  │
│                          ▼                                  │
│  STEP 2 (Step 2, 2.1, 2.2 screenshots):                    │
│  ┌──────────────────────────────────────┐                   │
│  │ 2A. Ads Preview Cards:               │                   │
│  │     - Ad 1 / Ad 2 / Ad 3 (radio)    │                   │
│  │     - Each: thumbnail + text preview │                   │
│  │     - "One Post ID" checkbox         │                   │
│  │ 2B. Select Source:                   │                   │
│  │     ○ Existing Post                  │                   │
│  │     ○ Content Source                 │                   │
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │                   │
│  │ IF Existing Post:                    │                   │
│  │ 2C. Select Post:                     │                   │
│  │     - Search by ID                   │                   │
│  │     - Sort: Latest / Spent / ROAS    │                   │
│  │     - Grid of Post cards with:       │                   │
│  │       Page name + Post ID            │                   │
│  │       Video/image preview            │                   │
│  │       Primary text + headline        │                   │
│  │       Version string (e.g. i1.2-t27.2)│                  │
│  │       Spent + ROAS per post          │                   │
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │                   │
│  │ IF Content Source:                   │                   │
│  │ 2D. Select Media:                    │                   │
│  │     - Media Type: Video / Image      │                   │
│  │     - Date range picker              │                   │
│  │     - Product Code header            │                   │
│  │     - Horizontal scroll of versions  │                   │
│  │       with Version, Thumbnail, Spent,│                   │
│  │       ROAS, Details link             │                   │
│  │ 2E. Select Thumbnail:               │                   │
│  │     - Same horizontal layout         │                   │
│  │     - Versions: b66.2 (Latest), b66.1│                   │
│  │ 2F. (Below fold) Select Ad Text      │                   │
│  │                          [Back]      │                   │
│  └──────────────────────────────────────┘                   │
│                          │                                  │
│                          ▼                                  │
│  (Submit → Create campaign + adsets + ads on Meta API)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. SCREENSHOT ANALYSIS — STEP 1 (Initial Configuration)

### Screenshot: `Create New FB Ad Step 1.jfif`

**Modal title:** "Create New Facebook Ad Step 1"

| Section | Field | Type | Value in Screenshot | Notes |
|---------|-------|------|-------------------|-------|
| **Facebook Ad Strategy** | Select Facebook Ads Strategy | Dropdown | (empty — not selected yet) | Strategy is a reusable template |
| **Sellpage** | Sellpage | Dropdown | `jetjeans.us` (pre-filled) | Pre-filled when entering from Sellpage context |
| **Sellpage Ad Configuration** | | | | |
| | Facebook Page | Display (auto) | `JettJeans` [Primary] + ID `127816070405916` | Auto-loaded from sellpage → FbConnection |
| | Ad Account | Dropdown | "Select an Ad Account" | Empty — seller must pick |
| | Pixel | Dropdown | "Select a Pixel" | Empty — filtered by Ad Account? |
| | Conversion | Dropdown | "Select a Conversion" | Empty — filtered by Pixel? |
| **Actions** | | | | |
| | Cancel button | | Bottom right | |

**Key Observations — Step 1 initial state:**
1. **Strategy dropdown is the master control** — once selected, it populates the configuration form below
2. **Sellpage is pre-selected** — comes from the context (user clicked "Create New Ad" on jetjeans.us)
3. **Facebook Page is auto-detected** — the system knows which FB Page is linked to this sellpage. Shows "Primary" badge.
4. **Hierarchy chain:** Sellpage → FB Page (auto) → Ad Account (user picks) → Pixel (user picks) → Conversion (user picks)
5. **This maps directly to FbConnection hierarchy:** AD_ACCOUNT → PAGE → PIXEL → CONVERSION

---

### Screenshot: `Create New FB Ads - Step 1.1.jfif`

**Modal title:** "Create New Facebook Ad Step 1" (same step, after strategy selected)

**Strategy selected:** `CBO-113-Adv-Adv-CBO-DAILY-1-Maximize number of conversions-3-1 day-None-None-Advantage+-Advantage+-Desktop,Mobile...`

This strategy name encodes the full configuration — it's a **strategy template** that pre-fills all fields below:

#### 1D. Facebook Ad Strategy Configuration → Campaign

| Field | Type | Value | Notes |
|-------|------|-------|-------|
| Number of Campaigns | Number input | `2` | Creates 2 campaigns at once |
| Duplicate Post ID | Checkbox | unchecked | If checked, same Post ID reused across campaigns |
| Budget per Campaign | Currency input | `$` (empty) | User must enter |
| Campaign budget type | Text (readonly?) | `DAILY` | From strategy template |

#### 1E. Campaign Status

| Field | Type | Value |
|-------|------|-------|
| Campaign Status | Radio | `Active` ○ / `Pause` ○ — Active selected |

#### 1F. Schedule (Optional)

| Field | Type | Value |
|-------|------|-------|
| Start time | Date + Time picker | (empty, checkbox unchecked) |
| End time | Date + Time picker | (empty) |

#### 1G. Ad Set

| Field | Type | Value | Notes |
|-------|------|-------|-------|
| Number of Ads/Adset | Number input | `3` | Creates 3 ads per adset |
| Optimization Goal | Dropdown | "Maximize number of conversions" | From strategy |

#### 1H. Attribution Model

| Field | Type | Value |
|-------|------|-------|
| Attribution Model | Dropdown | `Standard` |

#### Attribution Windows

| Field | Type | Value |
|-------|------|-------|
| Click-through | Input/dropdown | `1 day` |
| Engaged-view (For video only) | Input/dropdown | `None` |
| View-through | Input/dropdown | `None` |

#### 1I. Audience

| Field | Type | Value |
|-------|------|-------|
| Audience type | Radio | `Advantage+` ○ / `Original` ○ — Advantage+ selected |
| Location | Text input | `United States` |
| Gender | Radio | `All` ○ / `Men` ○ / `Women` ○ — All selected |
| Language | Input | `All Languages` |
| Age (min) | Dropdown | `18` |
| Age (max) | Dropdown | `65+` |
| Minimum Age | Input | `18` |

#### Actions

| Button | Position |
|--------|----------|
| Cancel | Bottom right |
| **Next** | Bottom right (blue) |

**Key Observations — Step 1.1:**

1. **Strategy as Template Pattern:** The strategy name (`CBO-113-Adv-Adv-CBO-DAILY-1-...`) is essentially a **config preset** that encodes: CBO type, number of ads/adset, budget type, optimization goal, attribution windows, audience type, device targeting. When seller selects a strategy, ALL fields auto-populate.

2. **Number of Campaigns = batch creation.** Seller can create 2+ campaigns in one go. Combined with "Number of Ads/Adset = 3", this creates `2 campaigns × 1 adset × 3 ads = 6 ads` total.

3. **"Duplicate Post ID" checkbox** — Critical for scaling. If checked, all campaigns reuse the same Facebook Post (keeping social proof / engagement). If unchecked, each campaign gets a new post.

4. **Advantage+ audience** — This is Meta's broad targeting AI, not a manually defined audience. The "Original" option would show detailed interest/behavior targeting.

5. **Attribution windows are granular** — Click-through, Engaged-view (video), View-through. This is Meta's attribution model selection.

6. **The entire form maps to Meta Marketing API:** `Campaign.create()` + `Adset.create()` + `Ad.create()` payloads.

---

## 2. SCREENSHOT ANALYSIS — STEP 2 (Ad Content Selection)

### Screenshot: `Create-New-FBAds-Step2.jfif` (Existing Post mode)

**Modal title:** "Create New Facebook Ad Step 2"

#### 2A. Ads Preview Section

| Element | Description |
|---------|------------|
| Header | "Ads" / "Ads Details" |
| **One Post ID** | Checkbox (unchecked) — if checked, all ads share same post |
| **Ad 1** (selected) | Radio button, selected. Shows: `JettJeans3---` + thumbnail + "Primary Text 1" / **Header 1** / Description 1 |
| **Ad 2** | Radio button. Shows: `JettJeans3---` + thumbnail + "Primary Text 1" / **Header 1** / Description 1 |
| **Ad 3** | Radio button. Shows: `JettJeans3---` + thumbnail + "Primary Text 1" / **Header 1** / Description 1 |

**Note:** 3 ads because Step 1 set "Number of Ads/Adset = 3". Each ad is currently a placeholder awaiting post selection.

#### 2B. Select Source

| Option | Type | Selected |
|--------|------|----------|
| **Existing Post** | Radio | ● Selected |
| **Content Source** | Radio | ○ Not selected |

#### 2C. Select Post (Existing Post mode)

**Search + Sort bar:**
| Element | Description |
|---------|------------|
| Search | "Search ID" text input with 🔍 |
| Sort: Latest ↑ | Sort by most recent |
| Sort: Spent ↕ | Sort by total spend |
| Sort: ROAS ↕ | Sort by ROAS |

**Post Grid (4 columns visible):**

| Post | Page | Post ID | Title | Primary Text | Headline | Version | Spent | ROAS |
|------|------|---------|-------|-------------|----------|---------|-------|------|
| 1 | JettJeans | `127816070405916_122260166174036299` | "2025 Upgraded - More Soft - Higher Quality" | "⚠️These Jeans Fix Everything You Hat..." | "🔥The New Generation of "Dad Jeans"" | i1.2-t27.2 | $0.00 | N/A |
| 2 | JettJeans | `127816070405916_122260166186036299` | "2025 Upgraded - More Soft - Higher Quality" | "68 years of wisdom has led to the creat..." | "🔥The New Generation of "Dad Jeans"" | v62.2-b62.2-t23.2 | $0.00 | N/A |
| 3 | JettJeans | `127816070405916_122260166180036299` | "2025 Upgraded - More Soft - Higher Quality" | "68 years of wisdom has led to the creat..." | "🔥The New Generation of "Dad Jeans"" | v66.0-b66.0-t23.2 | $0.00 | N/A |
| 4 | JettJeans | `127816070405916_122260165964036299` | "2025 Upgraded - More Soft - Higher Quality" | "⚠️These Jeans Fix Everything You Hat..." | "🔥The New Generation of "Dad Jeans"" | i1.3-t27.2 | (cut off) | (cut off) |

**Key Observations — Existing Post mode:**

1. **Post ID format:** `{PageID}_{PostID}` — standard Meta `object_story_id` format
2. **Version string format varies:**
   - `i1.2-t27.2` → Image version + Text version (image ad)
   - `v62.2-b62.2-t23.2` → Video + Thumbnail (b=background) + Text (video ad)
   - `v66.0-b66.0-t23.2` → Video + Thumbnail + Text
   - `i1.3-t27.2` → Image + Text
3. **Spent + ROAS per post** — Each existing post shows its historical performance
4. **Sortable by Latest/Spent/ROAS** — Sellers can find winning posts quickly
5. **This is the "reuse winning post" workflow** — pick a post that already has social proof → create a new ad using that `object_story_id`

---

### Screenshot: `Create-New-FBAds-Step2.1.jfif` (Existing Post — No posts available)

Same layout as Step 2, but **Select Post** section shows:

> "No posts available. Please create a new ad post from Content Source."

**Implication:** When a sellpage has no existing posts, the system directs the seller to switch to "Content Source" mode to create a brand new ad creative.

---

### Screenshot: `Create-New-FBAds-Step2.2.jfif` (Content Source mode)

**Select Source:** `Content Source` is now selected (radio).

#### 2D. Select Media

| Element | Description |
|---------|------------|
| **Select Media Type** | Radio: `Video` ● (selected) / `Image` ○ |
| **Date Range** | `19-01-2026 | 26-01-2026` (date range picker, top right) |
| **Product Code** | `JettJeans3` (header label) |

**Media Grid (horizontal scroll):**

| Version | Thumbnail | Spent | ROAS | Details |
|---------|-----------|-------|------|---------|
| v11.0 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v11.1 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v12.0 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v13.0 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v13.1 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v14.0 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v14.1 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v14.2 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v7.0 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v4.0 | Video preview ▶ (⋮) | $0.00 | N/A | Details |
| v1... | (cut off) | $0... | N/... | De... |

**Note:** Sort arrow on "Version ↓" and "Spent ↕" / "ROAS ↕" — same as Ad Content tab.

#### 2E. Select Thumbnail

| Element | Description |
|---------|------------|
| **Product Code** | `JettJeans3` |
| **Version ↑** | Sort by version (ascending) |

**Thumbnail Grid (horizontal scroll):**

| Version | Image | Notes |
|---------|-------|-------|
| b66.2 (Latest) | Thumbnail image | Has "(Latest)" badge |
| b66.1 | Thumbnail image | |
| b66.0 | Thumbnail image | |
| b65.2 | Thumbnail image | |
| b65.1 | Thumbnail image | |
| b65.0 | Thumbnail image | |
| b64.2 | Thumbnail image | |
| b64.1 | Thumbnail image | |
| b64.0 | Thumbnail image | |
| b63.2 | Thumbnail image | |
| b6... | (cut off) | |

**Note:** Below fold would be **Select Ad Text** section (not visible in screenshot, but follows the same pattern as Media and Thumbnail sections).

#### Actions

| Button | Position |
|--------|----------|
| **Back** | Bottom right |

---

## 3. AD CREATION FLOW — TWO MODES SUMMARY

### Mode A: Existing Post (Reuse)
```
Seller selects existing FB post → object_story_id is reused
→ New ad points to same post → keeps likes/comments/shares
→ CRITICAL for scaling: social proof retained
→ Post already has: video + thumbnail + text baked in
→ Seller just picks which post → done
```

### Mode B: Content Source (New Creative)
```
Seller builds new creative from platform assets:
  1. Pick Media (video or image) by version
  2. Pick Thumbnail by version
  3. Pick Ad Text by version
→ System creates new FB Post with these assets
→ New ad points to new post → fresh, no social proof
→ Used for TESTING new creative hypotheses
```

### Mode Comparison

| Aspect | Existing Post | Content Source |
|--------|--------------|----------------|
| **Use case** | Scale winning creatives | Test new creative combinations |
| **Social proof** | ✅ Retained | ❌ Starts from zero |
| **Asset selection** | Pick whole post (bundled) | Pick individual assets (media + thumb + text) |
| **Speed** | Fast — 1 click per ad | Slower — 3 selections per ad |
| **Performance data** | Shows Spent + ROAS per post | Shows Spent + ROAS per asset version |
| **Post ID** | Reuses existing `object_story_id` | System creates new `object_story_id` |

---

## 4. GAP ANALYSIS — PixEcom v2 vs Selles Ad Creation

### 4A. Step 1 — Strategy + Campaign Configuration

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Ad Strategy template** | ✅ Dropdown with encoded strategy name | ✅ `AdStrategy` model exists (id, name, config JSON) | Schema OK — needs CRUD endpoints + strategy config structure |
| **Strategy auto-fills form** | ✅ All campaign/adset/audience fields populated | ❌ No strategy config parsing | **NEW: Strategy config → form mapping** |
| **Sellpage pre-selection** | ✅ Pre-filled from context | ❌ No sellpage context passing | Frontend routing |
| **Facebook Page auto-detect** | ✅ Auto-loaded from sellpage → FbConnection | ✅ FbConnection model with PAGE type | Needs: Sellpage → Page lookup endpoint |
| **Ad Account dropdown** | ✅ Filtered by seller | ✅ FbConnection AD_ACCOUNT type | Needs: Filtered FbConnection list endpoint |
| **Pixel dropdown** | ✅ Filtered by Ad Account | ✅ FbConnection PIXEL type | Needs: Cascading filter (parentId) |
| **Conversion dropdown** | ✅ Filtered by Pixel | ✅ FbConnection CONVERSION type | Needs: Cascading filter (parentId) |
| **Number of Campaigns** | ✅ Batch creation (2+) | ❌ No batch creation concept | **MAJOR: Batch campaign creation** |
| **Duplicate Post ID checkbox** | ✅ Same post across campaigns | ❌ No concept | **NEW** |
| **Budget per Campaign** | ✅ Input | ✅ Campaign.budget field | OK |
| **Budget Type** | ✅ DAILY (from strategy) | ✅ BudgetType enum (DAILY, LIFETIME) | OK |
| **Campaign Status** | ✅ Active/Pause radio | ✅ CampaignStatus enum | OK |
| **Start/End time** | ✅ Optional date+time | ✅ Campaign.startDate/endDate | OK — but only Date, not DateTime |
| **Number of Ads/Adset** | ✅ Input (e.g., 3) | ❌ No bulk ad creation | **MAJOR: Bulk ad creation** |
| **Optimization Goal** | ✅ Dropdown | ✅ Adset.optimizationGoal | OK |
| **Attribution Model** | ✅ Standard dropdown | ❌ No attribution model field | **NEW field** |
| **Attribution Windows** | ✅ Click-through/Engaged-view/View-through | ❌ No attribution window fields | **NEW fields** |
| **Audience: Advantage+ / Original** | ✅ Radio toggle | ❌ Adset.targeting is generic JSON | Targeting JSON needs structure |
| **Location/Gender/Age/Language** | ✅ Dedicated inputs | ❌ All in Adset.targeting JSON | JSON structure needs spec |
| **Minimum Age** | ✅ Separate field | ❌ In targeting JSON | JSON structure |

### 4B. Step 2 — Ad Content Selection

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Ads preview cards (Ad 1/2/3)** | ✅ Radio selection, shows placeholder per ad | ❌ No ad preview UI concept | Frontend |
| **"One Post ID" checkbox** | ✅ Share single post across all ads | ❌ | **NEW: Post sharing flag** |
| **Select Source: Existing Post / Content Source** | ✅ Two modes | ✅ PostSource enum: EXISTING, CONTENT_SOURCE | Schema OK |
| **Existing Post: Search by ID** | ✅ Search bar | ❌ No post search endpoint | **NEW endpoint** |
| **Existing Post: Sort by Latest/Spent/ROAS** | ✅ | ❌ No post listing with stats | **NEW endpoint** |
| **Existing Post: Grid with Post ID + preview** | ✅ Card grid with video/image + text | ❌ No post listing | **NEW endpoint** |
| **Existing Post: Spent + ROAS per post** | ✅ | ❌ No stats per post | **Requires stats pipeline** |
| **Existing Post: Version string per post** | ✅ e.g., "v62.2-b62.2-t23.2" | ❌ No displayVersion on AdPost | **NEW field** |
| **Content Source: Media Type toggle** | ✅ Video/Image radio | ✅ MediaType enum | OK |
| **Content Source: Date Range filter** | ✅ Date picker | ❌ No date-range filtered asset list | **NEW query param** |
| **Content Source: Media version grid** | ✅ Horizontal scroll with Version/Spent/ROAS | ❌ No asset listing with stats | **Same as Ad Content tab endpoint** |
| **Content Source: Thumbnail version grid** | ✅ With "(Latest)" badge | ❌ Same | **Same as Ad Content tab endpoint** |
| **Content Source: Ad Text selection** | ✅ (below fold, inferred) | ❌ Same | **Same as Ad Content tab endpoint** |
| **Content Source: Product Code header** | ✅ "Product Code: JettJeans3" | ✅ Product.productCode | OK |

### 4C. Meta API Integration (THE BIGGEST GAP)

| Feature | Selles | PixEcom v2 | Gap |
|---------|--------|-----------|-----|
| **Create Campaign via Meta API** | ✅ | ❌ Schema only, NO Meta API calls | **CRITICAL: Meta Marketing API integration** |
| **Create Adset via Meta API** | ✅ | ❌ | **CRITICAL** |
| **Create Ad via Meta API** | ✅ | ❌ | **CRITICAL** |
| **Create Post (Content Source) via Meta API** | ✅ | ❌ | **CRITICAL** |
| **Reuse existing post (`object_story_id`)** | ✅ | ❌ | **CRITICAL** |
| **Batch creation (N campaigns × M ads)** | ✅ | ❌ | **CRITICAL** |
| **Campaign status sync** | ✅ | ❌ | **CRITICAL** |
| **Access token management** | ✅ | ✅ FbConnection.accessTokenEnc | Schema OK |
| **Ad Account hierarchy validation** | ✅ | ✅ FbConnection parent-child | Schema OK |

---

## 5. STRATEGY TEMPLATE DEEP-DIVE

### Strategy Name Decoding

From screenshot: `CBO-113-Adv-Adv-CBO-DAILY-1-Maximize number of conversions-3-1 day-None-None-Advantage+-Advantage+-Desktop,Mobile...`

Decoded structure:
```
CBO                                  → Campaign Budget Optimization
113                                  → Strategy ID / internal code
Adv-Adv                             → Advantage+ audience, Advantage+ placements
CBO                                 → Budget optimization type
DAILY                               → Budget type
1                                   → Number of adsets per campaign
Maximize number of conversions      → Optimization goal
3                                   → Number of ads per adset
1 day                               → Click-through attribution window
None                                → Engaged-view attribution window
None                                → View-through attribution window
Advantage+                          → Audience type
Advantage+                          → Placement type
Desktop,Mobile                      → Device targeting
```

### Required Strategy Config Schema (for `AdStrategy.config` JSON)

```json
{
  "campaignBudgetOptimization": true,
  "budgetType": "DAILY",
  "numAdsetsPerCampaign": 1,
  "numAdsPerAdset": 3,
  "optimizationGoal": "CONVERSIONS",
  "attribution": {
    "model": "STANDARD",
    "clickThrough": "1_DAY",
    "engagedView": "NONE",
    "viewThrough": "NONE"
  },
  "audience": {
    "type": "ADVANTAGE_PLUS",
    "location": ["US"],
    "gender": "ALL",
    "ageMin": 18,
    "ageMax": 65,
    "minimumAge": 18,
    "languages": []
  },
  "placements": {
    "type": "ADVANTAGE_PLUS",
    "devices": ["DESKTOP", "MOBILE"]
  }
}
```

---

## 6. REQUIRED CHANGES FOR TECH LEAD

### 6.1 New API Endpoints

---

#### `POST /api/ad-strategies` (CRUD for Strategy Templates)
**Purpose:** Create/manage reusable ad strategy templates
**Auth:** JWT (seller-scoped)
**Body:**
```json
{
  "name": "CBO-Daily-Conversions-3ads",
  "config": { /* Strategy config JSON as above */ }
}
```
**Also needed:**
- `GET /api/ad-strategies` — List seller's strategies
- `GET /api/ad-strategies/:id` — Get strategy details
- `PUT /api/ad-strategies/:id` — Update strategy
- `DELETE /api/ad-strategies/:id` — Soft delete

**Effort:** 2 days (CRUD is straightforward, AdStrategy model exists)

---

#### `GET /api/sellpages/:sellpageId/ad-config` (Sellpage Ad Configuration)
**Purpose:** Get the FB connection hierarchy for a sellpage (auto-detect Page, list Ad Accounts, etc.)
**Auth:** JWT
**Response:**
```json
{
  "sellpageId": "uuid",
  "sellpageDomain": "jetjeans.us",
  "facebookPage": {
    "id": "uuid",
    "externalId": "127816070405916",
    "name": "JettJeans",
    "isPrimary": true
  },
  "adAccounts": [
    {
      "id": "uuid",
      "externalId": "act_123456",
      "name": "JettJeans Ad Account 1"
    }
  ],
  "pixels": [],
  "conversions": []
}
```
**Business Logic:**
1. Get sellpage by ID + sellerId
2. Find linked FbConnection WHERE type=PAGE (from sellpage config or sellerId primary page)
3. Find all AD_ACCOUNTs for this seller
4. Return hierarchy for cascading dropdown population

**Effort:** 1.5 days

---

#### `GET /api/sellpages/:sellpageId/ad-config/cascade` (Cascading Dropdowns)
**Purpose:** Get child FbConnections when parent is selected
**Auth:** JWT
**Params:**
```
parentId: uuid (selected Ad Account → returns Pixels; selected Pixel → returns Conversions)
connectionType: FbConnectionType
```
**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "externalId": "pixel_123",
      "name": "JettJeans Pixel",
      "isPrimary": false
    }
  ]
}
```

**Effort:** 0.5 day (simple query: FbConnection WHERE parentId AND connectionType AND sellerId)

---

#### `POST /api/campaigns/batch-create` (THE CORE ENDPOINT — Batch Campaign Creation)
**Purpose:** Create N campaigns × M ads in one request, then push to Meta API
**Auth:** JWT
**Body:**
```json
{
  "sellpageId": "uuid",
  "adStrategyId": "uuid",
  "adAccountId": "uuid (FbConnection)",
  "pageId": "uuid (FbConnection)",
  "pixelId": "uuid (FbConnection)",
  "conversionId": "uuid (FbConnection)",
  "campaign": {
    "count": 2,
    "budgetPerCampaign": 50.00,
    "budgetType": "DAILY",
    "status": "ACTIVE",
    "startDate": "2026-02-20T00:00:00Z",
    "endDate": null
  },
  "adset": {
    "optimizationGoal": "CONVERSIONS",
    "attribution": {
      "model": "STANDARD",
      "clickThrough": "1_DAY",
      "engagedView": "NONE",
      "viewThrough": "NONE"
    },
    "audience": {
      "type": "ADVANTAGE_PLUS",
      "location": ["US"],
      "gender": "ALL",
      "ageMin": 18,
      "ageMax": 65,
      "languages": []
    }
  },
  "ads": [
    {
      "postSource": "EXISTING",
      "existingPostId": "127816070405916_122260166174036299",
      "onePostId": false
    },
    {
      "postSource": "CONTENT_SOURCE",
      "assetMediaId": "uuid",
      "assetThumbnailId": "uuid",
      "assetAdtextId": "uuid"
    }
  ],
  "duplicatePostId": false
}
```

**Response:**
```json
{
  "created": {
    "campaigns": [
      {
        "id": "uuid",
        "externalCampaignId": "meta_campaign_123",
        "name": "JettJeans3-CBO-2026-02-20-001",
        "status": "ACTIVE"
      }
    ],
    "adsets": [...],
    "ads": [...],
    "adPosts": [...]
  },
  "errors": []
}
```

**Business Logic (Complex — multi-step):**
```
1. Validate all FbConnection IDs belong to seller + are active
2. Validate sellpage belongs to seller
3. Parse strategy config (or use inline overrides)
4. FOR each campaign (1..count):
   a. Create Campaign record in DB
   b. Create 1 Adset record per campaign
   c. FOR each ad in ads array:
      i.  IF postSource = EXISTING:
          - Store object_story_id reference
          - Create AdPost with externalPostId
      ii. IF postSource = CONTENT_SOURCE:
          - Validate asset IDs exist
          - Create AdPost with assetMediaId + assetThumbnailId + assetAdtextId
   d. Create Ad records (linking adset → ad → adPost)
5. Push to Meta Marketing API:
   a. Create Campaign via API → get externalCampaignId
   b. Create Adset via API → get externalAdsetId
   c. FOR each ad:
      - IF CONTENT_SOURCE: Create FB post first → get object_story_id
      - Create Ad via API with object_story_id → get externalAdId
6. Update DB records with external IDs
7. Return created entities
```

**Effort:** 8-10 days (includes Meta API integration, error handling, rollback logic)

---

#### `GET /api/sellpages/:sellpageId/posts` (List Existing Posts for Selection)
**Purpose:** List all existing Facebook posts for a sellpage, with performance stats
**Auth:** JWT
**Params:**
```
search?: string (search by Post ID)
sortBy?: "latest" | "spent" | "roas" (default: "latest")
sortOrder?: "asc" | "desc"
page?: number
perPage?: number (default: 20)
```
**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "externalPostId": "127816070405916_122260166174036299",
      "pageName": "JettJeans",
      "pageExternalId": "127816070405916",
      "postSource": "CONTENT_SOURCE",
      "displayVersion": "v62.2-b62.2-t23.2",
      "preview": {
        "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
        "primaryText": "68 years of wisdom has led to the creat...",
        "headline": "🔥The New Generation of \"Dad Jeans\"",
        "description": "2025 Upgraded - More Soft - Higher Quality"
      },
      "stats": {
        "spent": 298.26,
        "roas": 1.54
      },
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 1011,
  "page": 1,
  "perPage": 20
}
```

**Business Logic:**
```
1. Get all AdPosts WHERE sellerId AND linked to sellpage
   (AdPost → Ad → Adset → Campaign → sellpageId)
2. For each AdPost:
   a. Get page info from FbConnection (pageId)
   b. Get asset info from AssetMedia/Thumbnail/Adtext for preview
   c. Build displayVersion from asset versions
   d. Aggregate stats from AdStatsDaily (via Ad)
3. Sort by requested field
4. Paginate
```

**Effort:** 3 days (complex join + stats aggregation)

---

#### `GET /api/products/:productCode/assets-for-ad` (Assets for Content Source Selection)
**Purpose:** List assets by type for ad creation (same data as Ad Content tab, but filtered for ad creation context)
**Auth:** JWT
**Params:**
```
mediaType?: "VIDEO" | "IMAGE" (for media section)
assetType: "media" | "thumbnail" | "adtext"
sortBy?: "version" | "spent" | "roas"
dateFrom?: date
dateTo?: date
```
**Response:** Same shape as `GET /api/products/:id/ad-content` but for a single asset type.

**Note:** This can reuse the same service logic as the Ad Content tab endpoint from `competitor-audit-product.md`.

**Effort:** 1 day (reuses Ad Content endpoint logic)

---

### 6.2 Schema Changes Required

#### 6.2.1 AdStrategy Config Structure

The `AdStrategy.config` JSON field already exists. Define the schema:

```typescript
// types/ad-strategy-config.ts
interface AdStrategyConfig {
  // Campaign level
  campaignBudgetOptimization: boolean;
  budgetType: 'DAILY' | 'LIFETIME';

  // Adset level
  numAdsetsPerCampaign: number;     // default 1
  numAdsPerAdset: number;           // default 3
  optimizationGoal: string;         // 'CONVERSIONS' | 'LINK_CLICKS' | etc.

  // Attribution
  attribution: {
    model: 'STANDARD' | '7_DAY_CLICK' | 'CUSTOM';
    clickThrough: '1_DAY' | '7_DAY' | 'NONE';
    engagedView: '1_DAY' | 'NONE';
    viewThrough: '1_DAY' | 'NONE';
  };

  // Audience
  audience: {
    type: 'ADVANTAGE_PLUS' | 'ORIGINAL';
    location: string[];              // country codes
    gender: 'ALL' | 'MALE' | 'FEMALE';
    ageMin: number;
    ageMax: number;
    minimumAge?: number;
    languages: string[];
    // Only if type = ORIGINAL:
    interests?: string[];
    behaviors?: string[];
    customAudiences?: string[];
  };

  // Placements
  placements: {
    type: 'ADVANTAGE_PLUS' | 'MANUAL';
    devices: ('DESKTOP' | 'MOBILE')[];
    platforms?: ('FACEBOOK' | 'INSTAGRAM' | 'AUDIENCE_NETWORK')[];
  };
}
```

#### 6.2.2 New Fields on Existing Models

```prisma
// Campaign — add scheduling precision
model Campaign {
  // ... existing fields ...
  startTime    DateTime? @map("start_time") @db.Timestamptz  // upgrade from Date to Timestamptz
  endTime      DateTime? @map("end_time") @db.Timestamptz
  // Keep startDate/endDate for backward compat, deprecate later
}

// Adset — add attribution fields (or keep in targeting JSON)
model Adset {
  // ... existing fields ...
  attributionModel  String?  @map("attribution_model") @db.VarChar(50)
  // Attribution windows go in targeting JSON for now
}

// AdPost — add display version
model AdPost {
  // ... existing fields ...
  displayVersion  String?  @map("display_version") @db.VarChar(100)
  // e.g., "v62.2-b62.2-t23.2" — computed from asset versions
}
```

#### 6.2.3 New Model: AdCreationJob (for async batch creation)

```prisma
model AdCreationJob {
  id              String   @id @default(uuid()) @db.Uuid
  sellerId        String   @map("seller_id") @db.Uuid
  sellpageId      String   @map("sellpage_id") @db.Uuid
  adStrategyId    String?  @map("ad_strategy_id") @db.Uuid
  status          String   @default("PENDING") @db.VarChar(20)
  // PENDING → PROCESSING → COMPLETED → PARTIAL_FAILURE → FAILED
  payload         Json     @db.JsonB      // Full batch-create request body
  result          Json     @default("{}") @db.JsonB  // Created entity IDs + errors
  totalCampaigns  Int      @default(0) @map("total_campaigns")
  totalAds        Int      @default(0) @map("total_ads")
  completedAds    Int      @default(0) @map("completed_ads")
  failedAds       Int      @default(0) @map("failed_ads")
  errorLog        Json     @default("[]") @db.JsonB
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  completedAt     DateTime? @map("completed_at") @db.Timestamptz

  seller   Seller   @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  sellpage Sellpage @relation(fields: [sellpageId], references: [id])

  @@index([sellerId, status])
  @@map("ad_creation_jobs")
}
```

**Why a Job model?** Batch creation (2 campaigns × 3 ads = 6 Meta API calls) can take 10-30 seconds. This should be async:
1. Frontend submits → gets job ID immediately
2. Worker processes job (creates entities on Meta API one by one)
3. Frontend polls job status → shows progress bar
4. On completion, frontend redirects to Ads Manager

---

### 6.3 Meta Marketing API Integration Layer

This is the **largest missing piece** in PixEcom v2. The Ad Creation flow requires direct Meta Marketing API calls.

#### Required Meta API Endpoints

| Meta API Endpoint | Purpose | PixEcom v2 Status |
|------------------|---------|-------------------|
| `POST /{ad_account_id}/campaigns` | Create campaign | ❌ Not implemented |
| `POST /{ad_account_id}/adsets` | Create adset | ❌ Not implemented |
| `POST /{ad_account_id}/ads` | Create ad | ❌ Not implemented |
| `POST /{page_id}/feed` | Create page post (Content Source) | ❌ Not implemented |
| `GET /{page_id}/published_posts` | List existing posts | ❌ Not implemented |
| `GET /{ad_id}/insights` | Get ad performance data | ❌ Not implemented (worker placeholder) |

#### Recommended Service Architecture

```
apps/api/src/
  meta/
    meta.module.ts
    meta.service.ts              # Core Meta API client (HTTP + auth)
    meta-campaign.service.ts     # Campaign CRUD on Meta
    meta-adset.service.ts        # Adset CRUD on Meta
    meta-ad.service.ts           # Ad CRUD on Meta
    meta-post.service.ts         # Post CRUD on Meta
    meta-insights.service.ts     # Stats fetching (for worker)
    dto/
      create-campaign.dto.ts
      create-adset.dto.ts
      create-ad.dto.ts
      meta-error.dto.ts
    interfaces/
      meta-api-response.interface.ts
      meta-targeting.interface.ts
```

**Key Implementation Notes:**
1. **Access Token:** Use `FbConnection.accessTokenEnc` (decrypt at runtime), scoped to Ad Account
2. **Rate Limiting:** Meta API has per-ad-account rate limits. Use BullMQ for queueing.
3. **Error Handling:** Meta returns specific error codes (190=expired token, 100=invalid parameter, etc.). Map to user-friendly messages.
4. **Idempotency:** Store `externalCampaignId`/`externalAdsetId`/`externalAdId` immediately after creation. If job fails mid-way, skip already-created entities on retry.

**Effort:** 12-15 days (Meta API integration is the single largest workstream)

---

## 7. PRIORITY & EFFORT ESTIMATION

### P0 — Ad Strategy Management (Foundation)

| Item | Effort | Dependencies |
|------|--------|-------------|
| AdStrategy CRUD endpoints | 2 days | AdStrategy model exists |
| Strategy config TypeScript interface | 0.5 day | None |
| Strategy config validation (Zod/class-validator) | 1 day | Config interface |

**Total P0: ~3.5 dev days**

### P1 — Ad Creation Step 1 (Sellpage Ad Config)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Sellpage Ad Config endpoint (auto-detect FB Page) | 1.5 days | FbConnection data |
| Cascading FbConnection dropdown endpoint | 0.5 day | FbConnection hierarchy |
| Strategy → form auto-fill logic | 1 day | Strategy config interface |

**Total P1: ~3 dev days**

### P2 — Ad Creation Step 2 (Content Selection)

| Item | Effort | Dependencies |
|------|--------|-------------|
| List Existing Posts endpoint (with stats) | 3 days | AdPost + stats pipeline |
| Assets for Content Source endpoint | 1 day | Reuses Ad Content endpoint |
| Display version computation | 0.5 day | Asset version fields |

**Total P2: ~4.5 dev days**

### P3 — Meta API Integration (CRITICAL PATH)

| Item | Effort | Dependencies |
|------|--------|-------------|
| Meta API client service (auth, HTTP, error handling) | 3 days | FbConnection access tokens |
| Campaign creation on Meta | 2 days | Meta client |
| Adset creation on Meta | 2 days | Meta client |
| Ad creation on Meta (with object_story_id) | 2 days | Meta client |
| Post creation on Meta (Content Source) | 2 days | Meta client |
| Batch creation job (AdCreationJob + BullMQ worker) | 3 days | All above |
| Error handling + retry logic + rollback | 2 days | Job system |

**Total P3: ~16 dev days**

### P4 — Polish + Edge Cases

| Item | Effort |
|------|--------|
| "One Post ID" checkbox logic | 0.5 day |
| "Duplicate Post ID" across campaigns | 0.5 day |
| Job status polling endpoint | 0.5 day |
| Validation: budget limits, audience constraints | 1 day |
| Frontend: Step 1 + Step 2 wizard | 5 days (frontend) |

**Total P4: ~7.5 dev days**

---

### TOTAL EFFORT SUMMARY

| Priority | Backend | Frontend | Total |
|----------|---------|----------|-------|
| P0 (Strategy CRUD) | 3.5d | 2d | 5.5d |
| P1 (Step 1 Config) | 3d | 3d | 6d |
| P2 (Step 2 Content) | 4.5d | 3d | 7.5d |
| P3 (Meta API) | 16d | — | 16d |
| P4 (Polish) | 2.5d | 5d | 7.5d |
| **TOTAL** | **29.5d** | **13d** | **42.5d** |

**Note:** P3 (Meta API integration) is the critical path and largest workstream. It has ZERO overlap with frontend work — can be developed in parallel.

---

## 8. OWNER NOTES

> **From Product Owner:**
>
> Phần Ad Creation là **core workflow** của seller. Đây là nơi seller thực sự tạo quảng cáo và bắt đầu chi tiền. Flow phải:
>
> 1. **Nhanh** — Seller experienced chỉ cần chọn Strategy → chọn Post → Submit. 3 clicks.
> 2. **Batch** — Tạo nhiều campaign cùng lúc (2-5) với nhiều ads/campaign (3-5). Một lần submit tạo 6-25 ads.
> 3. **Smart defaults** — Strategy template pre-fill mọi thứ. Seller chỉ cần nhập budget.
> 4. **Two modes are ESSENTIAL:**
>    - **Existing Post** = Scale what's working (giữ social proof)
>    - **Content Source** = Test new creative (thử nghiệm)
> 5. **Post performance data** — Khi chọn Existing Post, seller phải thấy Spent + ROAS của từng post để pick winner
>
> **PixEcom v2 hiện tại:** Có schema cho Campaign/Adset/Ad/AdPost nhưng **KHÔNG có** endpoint nào để tạo chúng, và **KHÔNG có** Meta API integration. Đây là gap lớn nhất.
>
> **Priority:** Meta API integration (P3) nên bắt đầu ngay vì nó là critical path. P0-P2 có thể làm song song với frontend.

---

## 9. ARCHITECTURE WARNINGS

### 9.1 Meta API Rate Limits

Meta Marketing API has per-ad-account rate limits:
- **Tier 1** (new accounts): ~200 calls/hour
- **Tier 2** (established): ~2000 calls/hour
- Each campaign/adset/ad creation = 1 API call

For batch creation of 2 campaigns × 1 adset × 3 ads = **8 API calls minimum** (2 campaigns + 2 adsets + 3 ads + potentially 3 post creations). At scale with 100+ sellers creating ads simultaneously → need request queueing.

**Recommendation:** Use BullMQ queue per ad_account_id with rate limiting.

### 9.2 Token Refresh

Meta access tokens expire. `FbConnection.accessTokenEnc` needs:
- Automatic refresh before expiry
- Graceful error handling when token is invalid
- Seller notification when re-auth is needed

### 9.3 Async Job Pattern is Non-Negotiable

Batch creation MUST be async (AdCreationJob model). Reasons:
- 8+ sequential API calls = 5-30 second total latency
- Any single API call can fail (rate limit, validation error, network)
- Need partial success handling (5 of 6 ads created → don't rollback the 5)
- Frontend needs progress feedback

### 9.4 Strategy Template Versioning

If strategy config structure changes, existing strategies break. Consider:
- `configVersion` field on AdStrategy
- Migration path for old config formats
- Or: keep config very stable, validate on read

---

## 10. CURRENT STATE AUDIT — PixEcom v2 Creative System (Thumbnail + Video + Adtext)

> **Source:** Codebase scan — backend services, Prisma schema, frontend mocks
> **Reviewed:** 2026-02-20
> **Trigger:** PO hỏi "Creatives = Thumbnail + Video + Adtext — bên mình đã có đủ chưa?"

---

### 10.1 DUAL ASSET SYSTEM — Architecture Overview

PixEcom v2 có **2 hệ thống asset song song** — cả hai đều tồn tại và phục vụ mục đích khác nhau:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  LEGACY SYSTEM (Product-scoped, Team-wide)                     │
│  ────────────────────────────────────────                      │
│  AssetMedia      → Video/Image per product version (v5.0, v1.2)│
│  AssetThumbnail  → Thumbnail per product version (b66.2, b65.1)│
│  AssetAdtext     → Ad copy per product (primaryText, headline, │
│                    description) with version (t1.0, t8.2)      │
│                                                                │
│  USE CASE: Product → Ad Content tab (team-wide analytics)      │
│  AdPost links: assetMediaId, assetThumbnailId, assetAdtextId   │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  NEW SYSTEM (Seller-scoped, Bundle-based)                      │
│  ────────────────────────────────────────                      │
│  Asset           → Generic file registry (any media type)      │
│  Creative        → Bundle container (DRAFT → READY → ARCHIVED) │
│  CreativeAsset   → Join table with role slots:                 │
│                    PRIMARY_VIDEO, THUMBNAIL, PRIMARY_TEXT,      │
│                    HEADLINE, DESCRIPTION, EXTRA                 │
│                                                                │
│  USE CASE: Seller → Creative bundle management + validation    │
│  CampaignCreative links: Campaign ↔ Creative (BI attribution) │
│                                                                │
└────────────────────────────────────────────────────────────────┘

✅ DECISION (từ audit1.md + competitor-audit-product.md):
   Giữ CẢ HAI hệ thống — chúng phục vụ 2 analytical dimensions khác nhau.
   - Legacy → Per-asset version performance (Ad Content tab, team-wide)
   - New → Per-creative-bundle performance (Sellpage, per-seller)
```

---

### 10.2 IMPLEMENTATION STATUS MATRIX

#### A. Asset Registry (NEW system) — ✅ FULLY IMPLEMENTED

| Component | File | Status | Details |
|-----------|------|:------:|---------|
| **Asset model** | `schema.prisma` lines 799-825 | ✅ | Multi-source registry, deduplication (ingestionId + checksum) |
| **AssetRegistryService** | `apps/api/src/asset-registry/asset-registry.service.ts` (315 lines) | ✅ | `getSignedUploadUrl()`, `registerAsset()`, `listAssets()`, `getAsset()`, `ingestAsset()` |
| **AssetRegistryController** | `apps/api/src/asset-registry/asset-registry.controller.ts` | ✅ | 5 endpoints: `POST /api/assets/signed-upload`, `POST /api/assets/ingest`, `POST /api/assets`, `GET /api/assets`, `GET /api/assets/:id` |
| **Auth guards** | JwtAuthGuard (seller) + ApiKeyOrSuperadminGuard (internal) | ✅ | Proper access control |
| **R2 storage** | MediaModule (Cloudflare R2) | ✅ | Pre-signed upload URLs |

#### B. Creative CRUD (NEW system) — ✅ FULLY IMPLEMENTED

| Component | File | Status | Details |
|-----------|------|:------:|---------|
| **Creative model** | `schema.prisma` lines 830-848 | ✅ | seller-scoped, productId, status lifecycle, metadata JSON |
| **CreativeAsset model** | `schema.prisma` lines 857-871 | ✅ | role-based slots with single-slot enforcement |
| **CreativesService** | `apps/api/src/creatives/creatives.service.ts` (328 lines) | ✅ | Full CRUD + `attachAsset()`, `detachAsset()`, `validateCreative()`, `renderCreative()` |
| **CreativesController** | `apps/api/src/creatives/creatives.controller.ts` (112 lines) | ✅ | 8 endpoints |

**API Endpoints:**
```
POST   /api/creatives                    → Create creative bundle (DRAFT)
GET    /api/creatives                    → List seller's creatives
GET    /api/creatives/:id                → Get detail with asset slots
PATCH  /api/creatives/:id                → Update name/status/metadata
POST   /api/creatives/:id/assets         → Attach asset to role slot
DELETE /api/creatives/:id/assets/:role   → Detach asset from slot
POST   /api/creatives/:id/validate       → Validate DRAFT → READY
GET    /api/creatives/:id/render         → Compile render payload
```

**Validation Rules (DRAFT → READY by creativeType):**
```
VIDEO_AD:   PRIMARY_VIDEO (or THUMBNAIL fallback) + THUMBNAIL + PRIMARY_TEXT  ← Match Selles!
IMAGE_AD:   THUMBNAIL + PRIMARY_TEXT
TEXT_ONLY:  PRIMARY_TEXT
UGC_BUNDLE: PRIMARY_VIDEO
```

#### C. Legacy Product Assets — ✅ READ-ONLY IMPLEMENTED

| Component | File | Status | Details |
|-----------|------|:------:|---------|
| **AssetMedia model** | `schema.prisma` lines 289-308 | ✅ | productId, version, url, mediaType, isCurrent |
| **AssetThumbnail model** | `schema.prisma` lines 310-326 | ✅ | productId, version, url, isCurrent |
| **AssetAdtext model** | `schema.prisma` lines 328-342 | ✅ | productId, version, primaryText, headline, description |
| **AssetsService** | `apps/api/src/assets/assets.service.ts` (202 lines) | ✅ | `getMedia()`, `getThumbnails()`, `getAdtexts()` |
| **Endpoints** | 3 read-only endpoints | ✅ | `GET /api/products/:productId/assets/media\|thumbnails\|adtexts` |
| **Stats per asset** | | ⚠️ | **Stub only** — returns `spend: 0, roas: null`. Needs stats pipeline |

#### D. Ad Strategies — ✅ FULLY IMPLEMENTED

| Component | File | Status | Details |
|-----------|------|:------:|---------|
| **AdStrategy model** | `schema.prisma` | ✅ | name, config (JSONB), sellerId, isActive |
| **AdStrategiesService** | `apps/api/src/ad-strategies/ad-strategies.service.ts` (199 lines) | ✅ | Full CRUD + soft delete |
| **AdStrategiesController** | 5 endpoints | ✅ | `POST/GET/GET:id/PATCH/DELETE /api/fb/ad-strategies` |

**⚠️ Config structure gap:** Current implementation stores simplified config:
```typescript
// CURRENT config (implemented)
{
  budget: { budgetType: 'DAILY'|'LIFETIME', amount: number },
  audience: { mode: 'ADVANTAGE_PLUS'|'MANUAL', attributionWindowDays?: number },
  placements: string[]
}

// NEEDED config (from Selles audit Section 5)
{
  campaignBudgetOptimization: boolean,
  budgetType, numAdsetsPerCampaign, numAdsPerAdset,
  optimizationGoal,
  attribution: { model, clickThrough, engagedView, viewThrough },
  audience: { type, location[], gender, ageMin, ageMax, languages[] },
  placements: { type, devices[], platforms[] }
}
```

#### E. AdPost & Campaign Hierarchy — ✅ SCHEMA ONLY, ❌ NO IMPLEMENTATION

| Component | Schema | Service | Controller | Endpoint | Status |
|-----------|:------:|:-------:|:----------:|:--------:|--------|
| **Campaign** | ✅ | ❌ | ❌ | ❌ | Schema only |
| **Adset** | ✅ | ❌ | ❌ | ❌ | Schema only |
| **Ad** | ✅ | ❌ | ❌ | ❌ | Schema only |
| **AdPost** | ✅ | ❌ | ❌ | ❌ | Schema only |
| **CampaignCreative** | ✅ | ❌ | ❌ | ❌ | Schema only |
| **FbConnection** | ✅ | ✅ OAuth flow | ✅ | ✅ Connect/list | Auth only, no ad-config |

#### F. COMPLETELY MISSING — 🔴

| Component | Impact | Effort |
|-----------|--------|--------|
| **Meta Marketing API client** | Cannot create real ads on Facebook | 3 days |
| **Campaign creation on Meta** | Cannot push campaigns | 2 days |
| **Adset creation on Meta** | Cannot push adsets | 2 days |
| **Ad creation on Meta** | Cannot push ads | 2 days |
| **Post creation on Meta** (Content Source) | Cannot create FB posts from assets | 2 days |
| **Batch campaign creation endpoint** | Core feature of ad creation | 8-10 days |
| **AdCreationJob model** (async) | Batch creation needs async processing | Schema + worker |
| **Post listing endpoint** (Existing Post mode) | Cannot select existing posts | 3 days |
| **Asset-for-ad listing** (Content Source) | Cannot browse assets with stats | 1 day |
| **Sellpage ad-config endpoint** | Cannot populate FB Page/Ad Account dropdowns | 1.5 days |
| **Stats pipeline** (Meta → AdStatsDaily) | No per-asset/per-post Spent+ROAS data | 8 days |

---

### 10.3 CREATIVE FLOW READINESS — Selles vs PixEcom

```
SELLES AD CREATION FLOW:                           PIXECOM STATUS:
═══════════════════════                            ═══════════════

Step 1: Strategy Selection
├─ Chọn Strategy template                          ✅ CRUD có (5 endpoints)
├─ Auto-fill form from strategy                    ⚠️ Config đơn giản hơn Selles
├─ Chọn Sellpage (pre-filled)                      ❌ Chưa có ad-config endpoint
├─ FB Page auto-detect                             ❌ Chưa có sellpage→page lookup
├─ Ad Account / Pixel / Conversion cascade         ❌ Chưa có cascade endpoint
├─ Number of Campaigns (batch)                     ❌ Chưa có batch concept
├─ Budget per Campaign                             ✅ Campaign.budget schema có
├─ Campaign Status (Active/Pause)                  ✅ CampaignStatus enum có
├─ Start/End Time                                  ✅ Schema có (cần upgrade → Timestamptz)
├─ Ads per Adset                                   ❌ Chưa có
├─ Optimization Goal                               ✅ Adset.optimizationGoal có
├─ Attribution Model + Windows                     ❌ Chưa có fields
└─ Audience (Advantage+/Original, Location...)     ⚠️ Adset.targeting JSON generic

Step 2A: Existing Post Mode
├─ List existing FB posts                          ❌ Chưa có endpoint
├─ Search by Post ID                               ❌
├─ Sort by Latest/Spent/ROAS                       ❌ (cần stats pipeline)
├─ Post preview (video + text + headline)          ❌
├─ Version string (v62.2-b62.2-t23.2)             ❌ AdPost.displayVersion chưa có
└─ Pick post → reuse object_story_id               ❌

Step 2B: Content Source Mode
├─ Select Media (Video/Image)                      ✅ AssetMedia schema + read endpoint
│   ├─ Version list with thumbnails                ✅ AssetMedia.version + url
│   ├─ Spent per version                           ❌ Stats chưa có (stub = 0)
│   ├─ ROAS per version                            ❌ Stats chưa có (stub = null)
│   └─ Date range filter                           ❌ Chưa có date filter trên endpoint
├─ Select Thumbnail                                ✅ AssetThumbnail schema + read endpoint
│   ├─ Version list                                ✅ AssetThumbnail.version
│   ├─ "(Latest)" badge                            ✅ AssetThumbnail.isCurrent field
│   └─ Spent/ROAS per version                      ❌ Stats chưa có
├─ Select Ad Text                                  ✅ AssetAdtext schema + read endpoint
│   ├─ primaryText + headline + description        ✅ All 3 fields exist
│   ├─ Version list                                ✅ AssetAdtext.version
│   └─ Spent/ROAS per version                      ❌ Stats chưa có
└─ Combine → tạo new FB post                       ❌ Meta API chưa có

Submit: Batch Campaign Creation
├─ Create campaigns on Meta                        ❌ ZERO Meta API calls
├─ Create adsets on Meta                           ❌
├─ Create ads on Meta                              ❌
├─ Create posts on Meta (Content Source)            ❌
├─ Async job processing (BullMQ)                   ❌ AdCreationJob chưa có
└─ Progress tracking + error handling              ❌
```

---

### 10.4 ✅ GAP SCORE CARD

| Category | PixEcom Score | Selles Score | Verdict |
|----------|:------------:|:------------:|---------|
| Asset models (schema) | 9/10 | 9/10 | ✅ **Đủ** — cả 2 hệ thống |
| Creative CRUD backend | 8/10 | 9/10 | ✅ **Đủ** — full lifecycle |
| Asset read endpoints | 6/10 | 9/10 | ⚠️ Read-only, thiếu stats |
| Strategy templates | 7/10 | 9/10 | ⚠️ Config đơn giản hơn |
| Ad Config (FB Page/Account cascade) | 0/10 | 9/10 | 🔴 **Thiếu hoàn toàn** |
| Existing Post selection | 0/10 | 9/10 | 🔴 **Thiếu hoàn toàn** |
| Content Source + stats | 3/10 | 9/10 | 🔴 Schema có, stats chưa |
| Batch campaign creation | 0/10 | 9/10 | 🔴 **Thiếu hoàn toàn** |
| Meta Marketing API | 0/10 | 10/10 | 🔴 **CRITICAL — ZERO** |
| Per-asset performance stats | 0/10 | 8/10 | 🔴 **Blocker** |
| **OVERALL** | **3.3/10** | **9/10** | 🔴 **Foundation có, execution thiếu** |

---

### 10.5 KẾT LUẬN — TRẢ LỜI PO

**Q: "Creatives = Thumbnail + Video + Adtext — bên mình đã có đủ chưa?"**

**A: CÓ schema và CRUD cơ bản, CHƯA CÓ phần thực thi quan trọng nhất.**

| Layer | Status | Chi tiết |
|-------|:------:|----------|
| **Schema models** | ✅ **ĐỦ** | Cả Legacy (AssetMedia/Thumbnail/Adtext) và New (Asset/Creative/CreativeAsset) đều đầy đủ |
| **Creative bundling** (gộp Video+Thumb+Text) | ✅ **ĐỦ** | CreativesService: `attachAsset()` + `validateCreative()` → `DRAFT → READY` hoạt động |
| **Asset upload + storage** | ✅ **ĐỦ** | AssetRegistryService: signed upload → R2 → register with dedup |
| **Asset browsing** (list/read) | ✅ **ĐỦ** | 3 read-only endpoints cho product assets + 2 endpoints cho asset registry |
| **Per-asset stats** (Spent/ROAS per version) | 🔴 **CHƯA CÓ** | Endpoints return stub `spend:0, roas:null`. Cần stats pipeline |
| **Content Source selection UI data** | ⚠️ **60%** | Endpoints có nhưng thiếu stats, thiếu date filter |
| **Existing Post selection** | 🔴 **CHƯA CÓ** | Không có endpoint list/search posts |
| **Meta API → tạo ad thật** | 🔴 **ZERO** | Không thể tạo campaign/adset/ad trên Facebook |
| **Batch creation** | 🔴 **CHƯA CÓ** | Không có concept "N campaigns × M ads" |

**Nói ngắn gọn:**
- ✅ **"Ghép Thumbnail + Video + Adtext thành Creative"** → ĐÃ CÓ, hoạt động
- ✅ **"Upload và quản lý assets"** → ĐÃ CÓ, hoạt động
- 🔴 **"Dùng Creative đó để tạo Facebook Ad thật"** → CHƯA CÓ GÌ
- 🔴 **"Biết asset nào perform tốt để chọn"** → CHƯA CÓ (cần stats pipeline)

**Blocker #1:** Meta Marketing API integration (~16 dev days, zero overlap với frontend)
**Blocker #2:** Stats pipeline — AdStatsDaily cần populated để hiển thị Spent+ROAS per asset version

---

### 10.6 RECOMMENDED ACTION

```
IMMEDIATE (Week 1-2):
├─ 1. Upgrade AdStrategy config schema → match Selles format     → 1 day
├─ 2. Add Sellpage ad-config endpoint (FB Page cascade)           → 2 days
├─ 3. START Meta API client (core HTTP + auth + rate limiting)    → 3 days
└─ 4. START Stats sync worker (Meta Insights → AdStatsDaily)      → 5 days

WEEK 3-4:
├─ 5. Campaign/Adset/Ad creation on Meta                          → 6 days
├─ 6. Post listing endpoint (Existing Post mode)                  → 3 days
├─ 7. AdCreationJob + BullMQ async worker                         → 3 days
└─ 8. Batch creation endpoint (POST /api/campaigns/batch-create)  → 3 days

WEEK 5-6:
├─ 9. Frontend: Step 1 + Step 2 wizard                            → 8 days
├─ 10. Asset stats display (Spent/ROAS per version)               → 2 days
└─ 11. Error handling + retry + edge cases                        → 3 days
```

---

*End of Ad Creation audit — updated with current state analysis (2026-02-20)*
