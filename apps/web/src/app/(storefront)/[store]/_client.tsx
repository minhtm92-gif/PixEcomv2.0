'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MOCK_PRODUCTS, STORE_CONFIG, MockCartItem } from '@/mock/storefront';
import { PromoBar } from '@/components/storefront/PromoBar';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';

const CATS = [
  { label: 'All Products', value: '' },
  { label: '✨ New Arrivals', value: 'NEW_ARRIVALS' },
  { label: '🔥 Best Sellers', value: 'BESTSELLERS' },
  { label: '🏷️ Clearance Sale', value: 'CLEARANCE' },
];

export default function StoreHomePage() {
  const params = useParams<{ store: string }>();
  const storeSlug = params?.store ?? 'demo-store';

  const [cartItems, setCartItems] = useState<MockCartItem[]>([]);
  const [activeCat, setActiveCat] = useState('');

  const products = activeCat
    ? MOCK_PRODUCTS.filter(p => p.category === activeCat)
    : MOCK_PRODUCTS;

  const hero = MOCK_PRODUCTS[0];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PromoBar />
      <StorefrontHeader
        storeSlug={storeSlug}
        cartItems={cartItems}
        onCartUpdate={setCartItems}
      />

      {/* Hero section */}
      <section className="relative bg-gradient-to-br from-purple-50 via-white to-amber-50 overflow-hidden py-16 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10">
          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <span className="inline-block text-xs font-bold text-purple-600 tracking-widest uppercase bg-purple-100 px-3 py-1 rounded-full mb-4">
              Official Store
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
              {STORE_CONFIG.name}
            </h1>
            <p className="text-lg text-gray-600 mb-6 max-w-md">{STORE_CONFIG.tagline}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <button
                onClick={() => setActiveCat('BESTSELLERS')}
                className="flex items-center justify-center gap-2 px-7 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-purple-500/20"
              >
                Shop Best Sellers <ArrowRight size={16} />
              </button>
              <button
                onClick={() => setActiveCat('CLEARANCE')}
                className="flex items-center justify-center gap-2 px-7 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-2xl transition-colors"
              >
                Up to 60% OFF Sale
              </button>
            </div>
          </div>

          {/* Hero product image */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex-shrink-0">
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl shadow-purple-200">
              <img
                src={hero.images[0]}
                alt={hero.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-3 -right-3 bg-white rounded-2xl shadow-xl px-4 py-2 border border-gray-100">
              <p className="text-xs text-gray-500">Best Seller</p>
              <p className="font-bold text-purple-700">${hero.price}</p>
            </div>
            {hero.badge && (
              <div className="absolute -top-3 -left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                {hero.badge}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Products section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Our Collection</h2>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8">
          {CATS.map(c => (
            <button
              key={c.value}
              onClick={() => setActiveCat(c.value)}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCat === c.value
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map(p => {
              const off = Math.round((1 - p.price / p.comparePrice) * 100);
              return (
                <Link key={p.id} href={`/${storeSlug}/${p.slug}`} className="group block">
                  <div className="rounded-2xl overflow-hidden border border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all duration-200 bg-white">
                    {/* Image */}
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={e => {
                          (e.target as HTMLImageElement).src =
                            `https://picsum.photos/seed/${p.id}/400/400`;
                        }}
                      />
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        -{off}%
                      </span>
                      {p.badge && (
                        <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
                          {p.badge}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-amber-400 text-xs">★</span>
                        <span className="text-xs font-medium text-gray-700">{p.rating}</span>
                        <span className="text-xs text-gray-400">({p.reviewCount})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-700 text-base">${p.price}</span>
                        <span className="text-xs text-gray-400 line-through">${p.comparePrice}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">No products in this category</p>
          </div>
        )}
      </section>

      {/* Social proof strip */}
      <section className="bg-gray-900 text-white py-10 px-4 my-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-2xl sm:text-3xl font-bold mb-2">
            Loved by 10,000+ customers
          </p>
          <div className="flex items-center justify-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} className="text-amber-400 text-xl">
                ★
              </span>
            ))}
            <span className="ml-2 text-gray-400 text-sm">4.8 average rating</span>
          </div>
          <p className="text-gray-400 text-sm">
            Free shipping · 30-day returns · Secure checkout · Authentic products
          </p>
        </div>
      </section>

      <StorefrontFooter storeSlug={storeSlug} />
    </div>
  );
}
