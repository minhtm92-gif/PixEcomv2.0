# TASK-D-PREVIEW-2: Customer-Facing Storefront UI — Static Preview

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| **Date**    | 2026-02-23                                    |
| **Agent**   | Frontend (Next.js)                            |
| **Branch**  | `feature/2.4.2-alpha-ads-seed-v1`             |
| **Commit**  | `98537d9`                                     |
| **Build**   | GREEN (45 routes, 0 TS errors)                |

---

## Summary

Built the complete Customer-facing Storefront UI as a static preview — LynsieCharm-style jewelry store with light theme. 5 page types across route group `(storefront)`, powered by `mock/storefront.ts` (no API calls). 13 purpose-built storefront components using only explicit Tailwind classes (no CSS variables — overrides dark portal theme).

Scope:
- `mock/storefront.ts` — 4 products, 5 reviews, 3 discounts, store config
- `(storefront)/layout.tsx` — light theme override, no auth/sidebar
- **13 storefront components** — PromoBar, StorefrontHeader, HamburgerMenu, CartPanel, ImageGallery, VariantSelector, BoostModule, QuantitySelector, ReviewSection, DiscountPicker, TrustBadges, FloatingCheckoutButton, StorefrontFooter
- **5 page types** — Homepage, Sellpage (LynsieCharm clone), Checkout, Order Tracking, Policy pages

---

## Files Created

| File | Description |
|------|-------------|
| `apps/web/src/mock/storefront.ts` | Full mock dataset: 4 products (Bracelet, Earrings, Necklace, Pearl Set), 5 reviews, 3 tick-select discounts, STORE_CONFIG (LynsieCharm), sample cart |
| `apps/web/src/app/(storefront)/layout.tsx` | Light theme layout — `style={{ backgroundColor: '#ffffff' }}` wrapper overrides dark CSS variables from globals.css |
| `apps/web/src/components/storefront/PromoBar.tsx` | Dismissible promo bar with live countdown timer (useEffect, 1s interval) |
| `apps/web/src/components/storefront/StorefrontHeader.tsx` | Sticky header with logo, desktop nav, cart badge, hamburger — manages HamburgerMenu + CartPanel state |
| `apps/web/src/components/storefront/HamburgerMenu.tsx` | Left slide-out panel (`-translate-x-full` → `translate-x-0`) with backdrop |
| `apps/web/src/components/storefront/CartPanel.tsx` | Right slide-out panel with item list, qty controls, free shipping nudge, checkout link |
| `apps/web/src/components/storefront/ImageGallery.tsx` | Main image + thumbnails, prev/next arrows (visible on hover), dot indicators |
| `apps/web/src/components/storefront/VariantSelector.tsx` | Color swatches (round, 32px, hex fill, ring on active) + text pills |
| `apps/web/src/components/storefront/BoostModule.tsx` | BUNDLE_DISCOUNT tiers table + EXTRA_OFF amber banner |
| `apps/web/src/components/storefront/QuantitySelector.tsx` | − / qty / + with min/max guards |
| `apps/web/src/components/storefront/ReviewSection.tsx` | Rating summary + star breakdown bars + review list with verified badge |
| `apps/web/src/components/storefront/DiscountPicker.tsx` | Tick-select promotions (NOT code input) — checkbox style, tap to toggle |
| `apps/web/src/components/storefront/TrustBadges.tsx` | 4-col grid: Free Shipping, 30-Day Returns, Secure Payment, Authentic Products |
| `apps/web/src/components/storefront/FloatingCheckoutButton.tsx` | Fixed bottom-right, `md:hidden`, purple CTA |
| `apps/web/src/components/storefront/StorefrontFooter.tsx` | Dark footer (gray-900) with 4 columns, social links, PixEcom attribution |
| `apps/web/src/app/(storefront)/[store]/page.tsx` | Homepage: hero with CTA buttons, category filter tabs (useState, no URL), product grid |
| `apps/web/src/app/(storefront)/[store]/[slug]/page.tsx` | Sellpage: 2-col (image+info), all components wired, add-to-cart, buy-now, accordion tabs, reviews, related products |
| `apps/web/src/app/(storefront)/[store]/[slug]/checkout/page.tsx` | Checkout: contact form, address, shipping method (radio), discount picker, payment method, order summary, "place order" → success state |
| `apps/web/src/app/(storefront)/[store]/trackings/search/page.tsx` | Order tracking: search form → mock timeline (5 steps, CheckCircle/Clock icons) |
| `apps/web/src/app/(storefront)/[store]/pages/[page]/page.tsx` | Policy pages: shipping/returns/privacy/terms — renders from STORE_CONFIG.policies with inline bold markdown |

---

## Mock Data Structure (`mock/storefront.ts`)

```typescript
// Interfaces
MockVariantOption     // label, value, color?, available
MockVariant           // name, options[]
MockBoostModule       // type (BUNDLE_DISCOUNT | EXTRA_OFF), title, tiers?, description?
MockStorefrontProduct // all product fields
MockReview            // author, rating, date, title, body, verified
MockCheckoutDiscount  // label, description, value, type, amount
MockStoreConfig       // name, slug, domain, tagline, promoMessage, promoEndHours, policies
MockCartItem          // id, productId, slug, name, image, price, qty, variant?

// Exports
STORE_CONFIG         LynsieCharm — purple theme, 2h flash sale countdown
MOCK_PRODUCTS[4]     Bracelet (BESTSELLERS), Earrings (NEW_ARRIVALS), Necklace (CLEARANCE), Pearl Set (BESTSELLERS)
MOCK_REVIEWS[5]      Verified + unverified, 4-5 star ratings
MOCK_CHECKOUT_DISCOUNTS[3]  Welcome 10%, Bundle $5, Flash Sale 15%
MOCK_SAMPLE_CART     1 bracelet pre-loaded (for CartPanel demo)
```

---

## Decisions & Technical Notes

### Light Theme Strategy

globals.css sets dark CSS variables on `:root` and `body`. Storefront layout overrides:

```tsx
// (storefront)/layout.tsx
<div style={{ backgroundColor: '#ffffff', color: '#111111', minHeight: '100vh' }}>
  {children}
</div>
```

All storefront components use explicit Tailwind classes only:
- `bg-white`, `text-gray-900`, `text-gray-600`, `text-gray-400`
- `border-gray-100`, `border-gray-200`
- `bg-purple-600`, `bg-purple-50`, `text-purple-700`
- `bg-amber-50`, `border-amber-200`
- **NEVER**: `bg-background`, `text-foreground`, `border-border` (dark CSS vars)

### Route Group — No URL Prefix

`(storefront)` is a Next.js route group. The URL paths are:
```
/demo-store                          → [store]/page.tsx
/demo-store/lynsie-charm-bracelet    → [store]/[slug]/page.tsx
/demo-store/lynsie-charm-bracelet/checkout  → [store]/[slug]/checkout/page.tsx
/demo-store/trackings/search         → [store]/trackings/search/page.tsx
/demo-store/pages/privacy            → [store]/pages/[page]/page.tsx
```

Static folder names (`trackings/`, `pages/`) take priority over `[slug]` in Next.js routing — no conflicts.

### Category Filter — Local State (No URL)

Homepage uses `useState` for category filtering to avoid `useSearchParams` Suspense boundary requirement:

```tsx
const [activeCat, setActiveCat] = useState('');
const products = activeCat ? MOCK_PRODUCTS.filter(p => p.category === activeCat) : MOCK_PRODUCTS;
```

### Slide-out Panels (HamburgerMenu + CartPanel)

Transform-based animation with backdrop:
```tsx
// HamburgerMenu: left slide
className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl transition-transform duration-300 ${
  open ? 'translate-x-0' : '-translate-x-full'
}`}

// CartPanel: right slide
className={`fixed top-0 right-0 h-full w-80 sm:w-96 bg-white z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
  open ? 'translate-x-0' : 'translate-x-full'
}`}
```

Backdrop uses opacity transition (not mount/unmount) so CSS transition works cleanly.

### Variant Selector — Color Swatches + Text Pills

```tsx
if (isColor) {
  // Round swatch with hex fill + ring on active
  <button style={{ backgroundColor: opt.color }} className="w-8 h-8 rounded-full border-2 ..." />
}
// Text pill (size, style, etc.)
<button className="px-4 py-1.5 rounded-lg border ...">
```

### BoostModule

Two rendering modes based on `type`:
- `BUNDLE_DISCOUNT`: purple card with tiers table (qty → discount badge)
- `EXTRA_OFF`: amber card with tag icon

### DiscountPicker — Tick-Select (PO Decision)

Uses checkbox-style toggle buttons, NOT a code input field. Each discount row has a visual checkbox square. Selecting one deselects others (radio behavior via `id | null` state):

```tsx
onSelect(isSelected ? null : d.id)  // toggle off if already selected
```

### Checkout Flow

Order summary is sticky sidebar (desktop). Discount savings computed inline:
```
discountAmount = type === 'percentage' ? (subtotal * amount / 100) : amount
```
"Place Order" button shows a success screen with mock order number (no actual API).

### Tracking Page

Search form → mock result showing 5-step timeline. Any non-empty order + email shows the result (demo mode hint shown at bottom).

### Policy Pages

`STORE_CONFIG.policies[key]` contains multi-paragraph text with `**bold**` markers. Simple inline renderer splits on `\n\n` and replaces `**text**` with `<strong>`.

---

## Build Results

```
next build → ✓ Compiled successfully
             ✓ Linting and checking validity of types
             ✓ Generating static pages (35/35)
             45 routes total, 0 errors
```

### Storefront Routes
```
ƒ /[store]                  2.3  kB   107 kB  (homepage)
ƒ /[store]/[slug]           5.85 kB   110 kB  (sellpage — main)
ƒ /[store]/[slug]/checkout  7.66 kB   104 kB  (checkout)
ƒ /[store]/pages/[page]     5.69 kB   102 kB  (policy pages)
ƒ /[store]/trackings/search 6.63 kB   103 kB  (order tracking)
```

---

## Manual Verification Checklist

### Light Theme
- [x] All storefront pages render on white background (not dark)
- [x] No CSS variable classes used in storefront components
- [x] Portal/admin pages unaffected — still dark

### PromoBar
- [x] Purple banner with promo message + countdown timer
- [x] Timer counts down in real time (1s interval)
- [x] X button dismisses bar

### StorefrontHeader
- [x] Sticky at top (z-30, below PromoBar)
- [x] Logo centered on all screen sizes
- [x] Desktop nav shows Home / New Arrivals / Best Sellers / Sale
- [x] Hamburger shows on mobile (md:hidden for desktop nav)
- [x] Cart icon shows badge with item count
- [x] Clicking cart icon opens CartPanel

### HamburgerMenu
- [x] Slides in from left on mobile
- [x] Backdrop click closes panel
- [x] Nav links to homepage with category params
- [x] Support links (Track Order, Shipping, Returns)

### CartPanel
- [x] Slides in from right
- [x] Empty state shows shopping bag icon + message
- [x] Items show image, name, variant, qty controls, price
- [x] +/- qty works; removing last item = empty state
- [x] Free shipping nudge shows when subtotal < $50
- [x] Checkout button links to `/[store]/[slug]/checkout`

### Homepage
- [x] Hero section: store name + tagline + 2 CTAs
- [x] Hero product image with badge
- [x] Category filter tabs: All / New Arrivals / Best Sellers / Clearance
- [x] Tab click filters product grid
- [x] Product cards: image, name, rating, price, compare-price, discount %
- [x] Product card → links to sellpage
- [x] Social proof strip at bottom

### Sellpage
- [x] Breadcrumb: Home > Product Name
- [x] 2-column layout on desktop (lg:grid-cols-2)
- [x] ImageGallery: main image, prev/next arrows on hover, dots, thumbnails
- [x] Thumbnail click changes active image
- [x] Product badge shown (BESTSELLERS, NEW_ARRIVALS, etc.)
- [x] Rating stars + review count with anchor to #reviews
- [x] Social proof: viewers + sold count
- [x] Price: current + compare + discount %
- [x] VariantSelector: color swatches + size pills
- [x] Selected variant label shown (e.g. "Color: Gold")
- [x] Unavailable options disabled (opacity-30, cursor-not-allowed)
- [x] BoostModule: bundle tiers table + extra-off banner
- [x] QuantitySelector: − / qty / + with min/max
- [x] "Add to Cart" button → adds to cart + "✓ Added!" feedback 2s
- [x] "Buy Now" → links to checkout
- [x] TrustBadges full row below main content
- [x] Description / Shipping / Returns accordion tabs
- [x] ReviewSection: rating summary + breakdown bars + 5 reviews
- [x] Related products grid (3 other products)
- [x] FloatingCheckoutButton shows on mobile

### Checkout
- [x] Contact fields: first name, last name, email, phone
- [x] Shipping address: street, city, state, zip
- [x] Shipping methods: Standard (free above $50), Express, Overnight
- [x] Free shipping auto-shown when subtotal ≥ $50
- [x] DiscountPicker: tick-select 3 promotions
- [x] Discount deducted from total instantly
- [x] Payment method: Card / PayPal / Apple Pay
- [x] Card fields shown (disabled for preview)
- [x] Order summary: product + subtotal + shipping + discount + total
- [x] "Place Order" → success screen with order number
- [x] Success screen shows Track Order link

### Order Tracking
- [x] Search form: order number + email
- [x] Empty/missing input → stays on form
- [x] Any valid input → shows mock tracking
- [x] Timeline: 5 steps with CheckCircle (done) / Clock (pending)
- [x] Carrier info card: USPS tracking number + estimated delivery

### Policy Pages
- [x] Shipping, returns, privacy, terms all render
- [x] Bold markdown (`**text**`) rendered as `<strong>`
- [x] "Other policies" links at bottom
- [x] Unknown page slug → 404-style message

---

## Preview URLs

```
/demo-store                                    → Store homepage
/demo-store/lynsie-charm-bracelet              → Hero product sellpage
/demo-store/crystal-drop-earrings              → Product 2
/demo-store/golden-layered-necklace            → Product 3
/demo-store/pearl-charm-set                    → Product 4
/demo-store/lynsie-charm-bracelet/checkout     → Checkout
/demo-store/trackings/search                   → Order tracking
/demo-store/pages/shipping                     → Shipping policy
/demo-store/pages/returns                      → Returns policy
/demo-store/pages/privacy                      → Privacy policy
/demo-store/pages/terms                        → Terms of service
```
