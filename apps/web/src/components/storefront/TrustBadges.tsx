import { Truck, RotateCcw, Shield, Award, type LucideIcon } from 'lucide-react';
import type { GuaranteeConfig } from '@/types/storefront';

const ICON_MAP: Record<string, LucideIcon> = {
  Truck,
  RotateCcw,
  Shield,
  Award,
};

const DEFAULT_BADGES = [
  { key: 'shipping', icon: 'Truck', label: 'Free Shipping', sub: 'On orders over $50', enabled: true },
  { key: 'returns', icon: 'RotateCcw', label: '30-Day Returns', sub: 'Hassle-free', enabled: true },
  { key: 'secure', icon: 'Shield', label: 'Secure Payment', sub: 'SSL encrypted', enabled: true },
  { key: 'quality', icon: 'Award', label: 'Authentic Products', sub: 'Guaranteed quality', enabled: true },
];

interface TrustBadgesProps {
  config?: GuaranteeConfig;
}

export function TrustBadges({ config }: TrustBadgesProps = {}) {
  // No config → show all 4 default badges (backward compat)
  if (!config) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
        {DEFAULT_BADGES.map(b => {
          const Icon = ICON_MAP[b.icon] ?? Shield;
          return (
            <div key={b.key} className="flex flex-col items-center text-center gap-2 py-2">
              <div className="w-10 h-10 rounded-full bg-[var(--sp-primary-light)] flex items-center justify-center">
                <Icon size={20} className="text-[var(--sp-primary)]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">{b.label}</p>
                <p className="text-xs text-gray-500">{b.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Config provided but master toggle off → hide entire section
  if (!config.enabled) return null;

  const visibleBadges = (config.badges ?? DEFAULT_BADGES).filter(b => b.enabled);
  if (visibleBadges.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
      {visibleBadges.map(b => {
        const Icon = ICON_MAP[b.icon] ?? Shield;
        return (
          <div key={b.key} className="flex flex-col items-center text-center gap-2 py-2">
            <div className="w-10 h-10 rounded-full bg-[var(--sp-primary-light)] flex items-center justify-center">
              <Icon size={20} className="text-[var(--sp-primary)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900">{b.label}</p>
              <p className="text-xs text-gray-500">{b.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
