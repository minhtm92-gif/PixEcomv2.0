import { Zap, Tag } from 'lucide-react';
import { MockBoostModule } from '@/mock/storefront';

interface BoostModuleProps {
  modules: MockBoostModule[];
  qty?: number;
}

/** Convert hex like "#2563eb" to a light background like "rgba(37,99,235,0.08)" */
function hexToLightBg(hex: string, alpha = 0.08): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(34,197,94,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Find the best matching discount tier for a given quantity */
function findMatchingTier(tiers: { quantity: number; discount: number }[], qty: number) {
  // Sort descending by quantity, pick highest tier that qty satisfies
  const sorted = [...tiers].sort((a, b) => b.quantity - a.quantity);
  return sorted.find(t => qty >= t.quantity) ?? tiers[0];
}

export function BoostModule({ modules, qty = 1 }: BoostModuleProps) {
  const visible = modules.filter(m => m.enabled !== false);
  if (!visible.length) return null;

  return (
    <div className="space-y-3">
      {visible.map((m, i) => {
        if (m.type === 'BUNDLE_DISCOUNT' && m.tiers) {
          return (
            <div key={i} className="rounded-xl border border-[var(--sp-primary-light)] bg-[var(--sp-primary-light)] overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--sp-primary-light)] flex items-center gap-2 border-b border-[var(--sp-primary-light)]">
                <Zap size={15} className="text-[var(--sp-primary)] fill-[var(--sp-primary)]" />
                <span className="text-sm font-semibold text-[var(--sp-primary-hover)]">{m.title}</span>
              </div>
              <div className="divide-y divide-[var(--sp-primary-light)]">
                {m.tiers.map((t, j) => (
                  <div key={j} className={`px-4 py-2 flex justify-between items-center ${qty >= t.qty ? 'bg-[var(--sp-primary)]/.05' : ''}`}>
                    <span className="text-sm text-gray-700">
                      Buy <span className="font-semibold text-gray-900">{t.qty}</span> items
                    </span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                      qty >= t.qty
                        ? 'text-white bg-[var(--sp-primary)]'
                        : 'text-[var(--sp-primary-hover)] bg-[var(--sp-primary-light)]'
                    }`}>
                      {t.discount} {qty >= t.qty ? '✓' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (m.type === 'EXTRA_OFF') {
          return (
            <div
              key={i}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3"
            >
              <Tag size={17} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{m.title}</p>
                {m.description && (
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{m.description}</p>
                )}
              </div>
            </div>
          );
        }

        if (m.type === 'UPSELL_NEXT_ITEM') {
          const accent = m.accentColor || '#22c55e';
          const bgLight = hexToLightBg(accent, 0.08);
          const borderColor = hexToLightBg(accent, 0.35);
          // Find the best matching tier for current qty
          const tiers = m.discountTiers ?? [];
          const matchedTier = tiers.length > 0 ? findMatchingTier(tiers, qty) : null;
          const discountVal = matchedTier?.discount ?? m.upsellPercent ?? 35;
          const rawHook = m.hookTemplate || m.title;
          const hookText = rawHook.replace(/\{discount\}/gi, String(discountVal));
          const subText = m.subText || m.description;

          return (
            <div
              key={i}
              className="border border-dashed rounded py-2 px-1.5 flex flex-col items-center justify-center text-center"
              style={{ borderColor, backgroundColor: bgLight }}
            >
              <span
                className="text-base font-extrabold uppercase tracking-wide"
                style={{ color: accent }}
              >
                {hookText}
              </span>
              {subText && (
                <span className="text-base font-medium" style={{ color: accent }}>
                  {subText}
                </span>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

/**
 * Utility: compute the effective upsell price based on qty and boost modules.
 * Discount is calculated on comparePrice.
 * Returns null if no upsell discount applies.
 */
export function computeUpsellPrice(
  modules: MockBoostModule[],
  qty: number,
  comparePrice: number,
): { effectivePrice: number; discountPct: number } | null {
  const upsell = modules.find(m => m.type === 'UPSELL_NEXT_ITEM' && m.enabled !== false);
  if (!upsell || !upsell.discountTiers || upsell.discountTiers.length === 0) return null;

  const matched = findMatchingTier(upsell.discountTiers, qty);
  if (!matched || qty < matched.quantity) return null;

  const discountPct = matched.discount;
  const effectivePrice = Math.round(comparePrice * (1 - discountPct / 100) * 100) / 100;
  return { effectivePrice, discountPct };
}
