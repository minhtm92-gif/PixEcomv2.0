'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Menu } from 'lucide-react';
import { HamburgerMenu } from './HamburgerMenu';
import { CartPanel } from './CartPanel';
import { MockCartItem, MockBoostModule, STORE_CONFIG } from '@/mock/storefront';
import { storeHref } from '@/lib/storefrontLinks';

interface StorefrontHeaderProps {
  storeSlug: string;
  storeName?: string;
  logoUrl?: string | null;
  cartItems: MockCartItem[];
  onCartUpdate: (items: MockCartItem[]) => void;
  /** Optional: externally controlled cart open state (parent can open cart) */
  cartOpen?: boolean;
  onCartOpenChange?: (open: boolean) => void;
  /** Boost modules for upsell banner in cart */
  boostModules?: MockBoostModule[];
}

export function StorefrontHeader({
  storeSlug,
  storeName,
  logoUrl,
  cartItems,
  onCartUpdate,
  cartOpen: externalCartOpen,
  onCartOpenChange,
  boostModules,
}: StorefrontHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [internalCartOpen, setInternalCartOpen] = useState(false);

  // Use external cart state if provided, else internal
  const cartOpen = externalCartOpen ?? internalCartOpen;
  const setCartOpen = onCartOpenChange ?? setInternalCartOpen;

  const totalItems = cartItems.reduce((sum, i) => sum + i.qty, 0);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="text-gray-600 hover:text-gray-900 transition-colors md:hidden"
          >
            <Menu size={22} />
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href={storeHref(storeSlug)} className="hover:text-[var(--sp-primary)] transition-colors">
              Home
            </Link>
            <Link
              href={storeHref(storeSlug, '?cat=NEW_ARRIVALS')}
              className="hover:text-[var(--sp-primary)] transition-colors"
            >
              New Arrivals
            </Link>
            <Link
              href={storeHref(storeSlug, '?cat=BESTSELLERS')}
              className="hover:text-[var(--sp-primary)] transition-colors"
            >
              Best Sellers
            </Link>
            <Link
              href={storeHref(storeSlug, '?cat=CLEARANCE')}
              className="hover:text-[var(--sp-primary)] transition-colors"
            >
              Sale
            </Link>
          </nav>

          {/* Logo (center) */}
          <Link
            href={storeHref(storeSlug)}
            className="absolute left-1/2 -translate-x-1/2 hover:opacity-80 transition-opacity"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={storeName ?? STORE_CONFIG.name} className="h-8 max-w-[160px] object-contain" />
            ) : (
              <span className="font-bold text-xl text-gray-900 tracking-tight">
                {storeName ?? STORE_CONFIG.name}
              </span>
            )}
          </Link>

          {/* Right: cart */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart (${totalItems} items)`}
              className="relative text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ShoppingCart size={22} />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--sp-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        storeSlug={storeSlug}
      />
      <CartPanel
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdate={onCartUpdate}
        storeSlug={storeSlug}
        boostModules={boostModules}
      />
    </>
  );
}
