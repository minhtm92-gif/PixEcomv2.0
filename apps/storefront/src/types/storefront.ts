/* ─────────────────────────────────────────────
 *  Storefront types — shared between storefront pages and portal config editors.
 *  Storefront-specific API types (SellpageData, StoreData, etc.) live in
 *  @/lib/storefrontApi.ts alongside the fetch helpers.
 * ───────────────────────────────────────────── */

// ── Guarantee / Trust Badges ──
export interface GuaranteeBadgeConfig {
  key: string;
  icon: string;
  label: string;
  sub: string;
  enabled: boolean;
}

export interface GuaranteeConfig {
  enabled: boolean;
  badges: GuaranteeBadgeConfig[];
}

// ── Boost Module ──
export interface BoostModuleConfig {
  type: 'BUNDLE_DISCOUNT' | 'EXTRA_OFF' | 'UPSELL_NEXT_ITEM';
  enabled: boolean;
  title: string;
  tiers?: { qty: number; discount: string }[];
  description?: string;
  hookTemplate?: string;
  subText?: string;
  accentColor?: string;
  discountTiers?: { quantity: number; discount: number }[];
}
