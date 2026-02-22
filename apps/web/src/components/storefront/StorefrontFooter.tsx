import Link from 'next/link';
import { Instagram, Facebook } from 'lucide-react';
import { STORE_CONFIG } from '@/mock/storefront';

interface StorefrontFooterProps {
  storeSlug: string;
}

export function StorefrontFooter({ storeSlug }: StorefrontFooterProps) {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-white font-bold text-lg mb-3">{STORE_CONFIG.name}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{STORE_CONFIG.tagline}</p>
            <div className="flex gap-3 mt-4">
              <a href="#" aria-label="Instagram" className="text-gray-400 hover:text-white transition-colors">
                <Instagram size={18} />
              </a>
              <a href="#" aria-label="Facebook" className="text-gray-400 hover:text-white transition-colors">
                <Facebook size={18} />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${storeSlug}`} className="hover:text-white transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href={`/${storeSlug}?cat=NEW_ARRIVALS`} className="hover:text-white transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href={`/${storeSlug}?cat=BESTSELLERS`} className="hover:text-white transition-colors">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href={`/${storeSlug}?cat=CLEARANCE`} className="hover:text-white transition-colors">
                  Sale / Clearance
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${storeSlug}/trackings/search`} className="hover:text-white transition-colors">
                  Track My Order
                </Link>
              </li>
              <li>
                <Link href={`/${storeSlug}/pages/shipping`} className="hover:text-white transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href={`/${storeSlug}/pages/returns`} className="hover:text-white transition-colors">
                  Returns & Exchanges
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${storeSlug}/pages/privacy`} className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href={`/${storeSlug}/pages/terms`} className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} {STORE_CONFIG.name}. All rights reserved.</span>
          <span>Powered by <span className="text-purple-400">PixEcom</span></span>
        </div>
      </div>
    </footer>
  );
}
