'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Zap, Eye, ChevronDown } from 'lucide-react';
import {
  MOCK_PRODUCTS,
  MOCK_REVIEWS,
  MockCartItem,
} from '@/mock/storefront';
import { PromoBar } from '@/components/storefront/PromoBar';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { ImageGallery } from '@/components/storefront/ImageGallery';
import { VariantSelector } from '@/components/storefront/VariantSelector';
import { BoostModule } from '@/components/storefront/BoostModule';
import { QuantitySelector } from '@/components/storefront/QuantitySelector';
import { TrustBadges } from '@/components/storefront/TrustBadges';
import { ReviewSection } from '@/components/storefront/ReviewSection';
import { FloatingCheckoutButton } from '@/components/storefront/FloatingCheckoutButton';

function AccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SellpagePage() {
  const params = useParams<{ store: string; slug: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const slug = params?.slug ?? '';

  // Product lookup
  const product =
    MOCK_PRODUCTS.find(p => p.slug === slug) ?? MOCK_PRODUCTS[0];

  // State
  const [cartItems, setCartItems] = useState<MockCartItem[]>([]);
  const [qty, setQty] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      product.variants.map(v => [v.name, v.options[0]?.value ?? ''])
    )
  );
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'shipping' | 'returns'>(
    'description'
  );

  const off = Math.round(
    (1 - product.price / product.comparePrice) * 100
  );

  function handleVariantChange(name: string, value: string) {
    setSelectedVariants(prev => ({ ...prev, [name]: value }));
  }

  function getVariantLabel() {
    return Object.entries(selectedVariants)
      .map(([k, v]) => {
        const variant = product.variants.find(vr => vr.name === k);
        const opt = variant?.options.find(o => o.value === v);
        return `${k}: ${opt?.label ?? v}`;
      })
      .join(' / ');
  }

  function addToCart() {
    const newItem: MockCartItem = {
      id: `cart_${Date.now()}`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.thumbnails[0],
      price: product.price,
      qty,
      variant: getVariantLabel(),
    };
    setCartItems(prev => {
      const existing = prev.find(
        i => i.productId === product.id && i.variant === newItem.variant
      );
      if (existing) {
        return prev.map(i =>
          i.id === existing.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [...prev, newItem];
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  const relatedProducts = MOCK_PRODUCTS.filter(p => p.id !== product.id).slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PromoBar />
      <StorefrontHeader
        storeSlug={storeSlug}
        cartItems={cartItems}
        onCartUpdate={setCartItems}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <Link href={`/${storeSlug}`} className="hover:text-purple-600 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-gray-700 truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          {/* LEFT: Image gallery */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ImageGallery
              images={product.images}
              thumbnails={product.thumbnails}
              name={product.name}
            />
          </div>

          {/* RIGHT: Product info */}
          <div className="space-y-5">
            {/* Badge */}
            {product.badge && (
              <span className="inline-block text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                {product.badge}
              </span>
            )}

            {/* Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>

            {/* Rating + social proof */}
            <div className="flex items-center flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span
                      key={s}
                      className={`text-sm ${
                        s <= Math.round(product.rating)
                          ? 'text-amber-400'
                          : 'text-gray-200'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {product.rating}
                </span>
                <a
                  href="#reviews"
                  className="text-sm text-purple-600 hover:underline"
                >
                  ({product.reviewCount} reviews)
                </a>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye size={13} /> {product.socialProof.viewers} viewing
                </span>
                <span>•</span>
                <span>{product.socialProof.purchased.toLocaleString()} sold</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-gray-900">
                ${product.price.toFixed(2)}
              </span>
              <span className="text-lg text-gray-400 line-through">
                ${product.comparePrice.toFixed(2)}
              </span>
              <span className="bg-red-100 text-red-600 text-sm font-bold px-2.5 py-1 rounded-full">
                {off}% OFF
              </span>
            </div>

            {/* Variants */}
            {product.variants.length > 0 && (
              <VariantSelector
                variants={product.variants}
                selected={selectedVariants}
                onChange={handleVariantChange}
              />
            )}

            {/* Boost modules */}
            {product.boostModules.length > 0 && (
              <BoostModule modules={product.boostModules} />
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Quantity</span>
              <QuantitySelector value={qty} onChange={setQty} />
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={addToCart}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all ${
                  addedToCart
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                <ShoppingCart size={18} />
                {addedToCart ? '✓ Added to Cart!' : 'Add to Cart'}
              </button>
              <Link
                href={`/${storeSlug}/${product.slug}/checkout`}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-semibold text-sm transition-colors"
              >
                <Zap size={16} />
                Buy Now
              </Link>
            </div>

            {/* Quick trust row */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
              <span>🚚 Free shipping on orders $50+</span>
              <span>🔄 30-day returns</span>
              <span>🔒 Secure checkout</span>
            </div>
          </div>
        </div>

        {/* Trust badges full row */}
        <div className="mt-12">
          <TrustBadges />
        </div>

        {/* Description / Shipping / Returns */}
        <div className="mt-10 max-w-2xl">
          {/* Tab buttons */}
          <div className="flex gap-0 border-b border-gray-200 mb-1">
            {(
              [
                { id: 'description', label: 'Description' },
                { id: 'shipping', label: 'Shipping' },
                { id: 'returns', label: 'Returns' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="py-5 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {activeTab === 'description' && product.description}
            {activeTab === 'shipping' && product.shippingInfo}
            {activeTab === 'returns' && product.returnPolicy}
          </div>
        </div>

        {/* Reviews */}
        <div id="reviews">
          <ReviewSection
            reviews={MOCK_REVIEWS}
            rating={product.rating}
            reviewCount={product.reviewCount}
          />
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div className="mt-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              You May Also Like
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map(rp => {
                const rOff = Math.round(
                  (1 - rp.price / rp.comparePrice) * 100
                );
                return (
                  <Link
                    key={rp.id}
                    href={`/${storeSlug}/${rp.slug}`}
                    className="group block"
                  >
                    <div className="rounded-xl overflow-hidden border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all">
                      <div className="relative aspect-square bg-gray-100 overflow-hidden">
                        <img
                          src={rp.images[0]}
                          alt={rp.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          -{rOff}%
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {rp.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-bold text-purple-700 text-sm">
                            ${rp.price}
                          </span>
                          <span className="text-xs text-gray-400 line-through">
                            ${rp.comparePrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Floating checkout (mobile) */}
      <FloatingCheckoutButton onClick={addToCart} />

      <StorefrontFooter storeSlug={storeSlug} />
    </div>
  );
}
