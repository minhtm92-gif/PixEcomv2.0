'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { STORE_CONFIG } from '@/mock/storefront';

const NAV_LINKS = [
  { label: 'Home', href: '' },
  { label: 'New Arrivals', href: '?cat=NEW_ARRIVALS' },
  { label: 'Best Sellers', href: '?cat=BESTSELLERS' },
  { label: 'Sale / Clearance', href: '?cat=CLEARANCE' },
];

interface HamburgerMenuProps {
  open: boolean;
  onClose: () => void;
  storeSlug: string;
}

export function HamburgerMenu({ open, onClose, storeSlug }: HamburgerMenuProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide panel */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900">{STORE_CONFIG.name}</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {NAV_LINKS.map(l => (
            <Link
              key={l.label}
              href={`/${storeSlug}${l.href}`}
              onClick={onClose}
              className="block px-3 py-2.5 text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg font-medium text-sm transition-colors"
            >
              {l.label}
            </Link>
          ))}

          <hr className="my-3 border-gray-100" />

          <Link
            href={`/${storeSlug}/trackings/search`}
            onClick={onClose}
            className="block px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg text-sm transition-colors"
          >
            Track My Order
          </Link>
          <Link
            href={`/${storeSlug}/pages/shipping`}
            onClick={onClose}
            className="block px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg text-sm transition-colors"
          >
            Shipping Info
          </Link>
          <Link
            href={`/${storeSlug}/pages/returns`}
            onClick={onClose}
            className="block px-3 py-2.5 text-gray-500 hover:bg-gray-50 rounded-lg text-sm transition-colors"
          >
            Returns
          </Link>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Powered by <span className="text-purple-500">PixEcom</span>
          </p>
        </div>
      </div>
    </>
  );
}
