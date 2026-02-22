'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Menu } from 'lucide-react';
import { HamburgerMenu } from './HamburgerMenu';
import { CartPanel } from './CartPanel';
import { MockCartItem, STORE_CONFIG } from '@/mock/storefront';

interface StorefrontHeaderProps {
  storeSlug: string;
  cartItems: MockCartItem[];
  onCartUpdate: (items: MockCartItem[]) => void;
}

export function StorefrontHeader({
  storeSlug,
  cartItems,
  onCartUpdate,
}: StorefrontHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

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
            <Link href={`/${storeSlug}`} className="hover:text-purple-600 transition-colors">
              Home
            </Link>
            <Link
              href={`/${storeSlug}?cat=NEW_ARRIVALS`}
              className="hover:text-purple-600 transition-colors"
            >
              New Arrivals
            </Link>
            <Link
              href={`/${storeSlug}?cat=BESTSELLERS`}
              className="hover:text-purple-600 transition-colors"
            >
              Best Sellers
            </Link>
            <Link
              href={`/${storeSlug}?cat=CLEARANCE`}
              className="hover:text-purple-600 transition-colors"
            >
              Sale
            </Link>
          </nav>

          {/* Logo (center) */}
          <Link
            href={`/${storeSlug}`}
            className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-gray-900 tracking-tight hover:text-purple-700 transition-colors"
          >
            {STORE_CONFIG.name}
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
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
      />
    </>
  );
}
