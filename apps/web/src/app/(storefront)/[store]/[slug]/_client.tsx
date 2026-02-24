'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Zap, Eye, ChevronDown, Loader2 } from 'lucide-react';
import {
  MOCK_PRODUCTS,
  MOCK_REVIEWS,
  MockCartItem,
  type MockVariant,
  type MockBoostModule,
} from '@/mock/storefront';
import { PromoBar } from '@/components/storefront/PromoBar';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { ImageGallery } from '@/components/storefront/ImageGallery';
import { VariantSelector } from '@/components/storefront/VariantSelector';
import { BoostModule } from '@/components/storefront/BoostModule';
import { QuantitySelector } from '@/components/storefront/QuantitySelector';
import { TrustBadges } from '@/components/storefront/TrustBadges';
import { ReviewSection, type ReviewItem } from '@/components/storefront/ReviewSection';
import { FloatingCheckoutButton } from '@/components/storefront/FloatingCheckoutButton';
import { fetchSellpage, type SellpageData, type SellpageVariant } from '@/lib/storefrontApi';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ─── Local shape the JSX expects ──────────────────────────────────────────

interface PageProduct {
  id: string;
  slug: string;
  name: string;
  rating: number;
  reviewCount: number;
  price: number;
  comparePrice: number;
  images: string[];
  thumbnails: string[];
  variants: MockVariant[];
  boostModules: MockBoostModule[];
  description: string;
  shippingInfo: string;
  returnPolicy: string;
  socialProof: { viewers: number; purchased: number };
  badge: string | null;
}

// Convert DB variants (rows with options: { color: 'gold', size: 'M' })
// into the MockVariant[] format: [{ name: 'Color', options: [...] }]
function reshapeVariants(dbVariants: SellpageVariant[]): MockVariant[] {
  const groupMap = new Map<string, Map<string, { label: string; value: string; available: boolean }>>();

  for (const v of dbVariants) {
    const opts = v.options as Record<string, string>;
    for (const [key, val] of Object.entries(opts)) {
      if (!groupMap.has(key)) groupMap.set(key, new Map());
      const optMap = groupMap.get(key)!;
      if (!optMap.has(val)) {
        optMap.set(val, {
          label: val.charAt(0).toUpperCase() + val.slice(1),
          value: val,
          available: v.stockQuantity > 0 && v.isActive,
        });
      }
    }
  }

  return Array.from(groupMap.entries()).map(([name, optMap]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    options: Array.from(optMap.values()),
  }));
}

function mapApiToProduct(data: SellpageData): PageProduct {
  return {
    id: data.product.id,
    slug: data.product.slug,
    name: data.sellpage.title,
    rating: data.product.rating || 0,
    reviewCount: data.product.reviewCount || 0,
    price: data.product.basePrice,
    comparePrice: data.product.compareAtPrice ?? data.product.basePrice * 2,
    images: data.product.images.length > 0
      ? data.product.images
      : [`https://picsum.photos/seed/${data.product.slug}/800/800`],
    thumbnails: data.product.thumbnails.length > 0
      ? data.product.thumbnails
      : data.product.images,
    variants: reshapeVariants(data.product.variants),
    boostModules: (data.sellpage.boostModules ?? []) as MockBoostModule[],
    description: data.product.description || data.sellpage.description,
    shippingInfo:
      typeof data.product.shippingInfo === 'string'
        ? data.product.shippingInfo
        : 'Ships in 1-2 business days. Free shipping on orders over $50.',
    returnPolicy: '30-day hassle-free returns.',
    socialProof: data.socialProof,
    badge: null,
  };
}

function mockProduct(slug: string): PageProduct {
  const p = MOCK_PRODUCTS.find(mp => mp.slug === slug) ?? MOCK_PRODUCTS[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    rating: p.rating,
    reviewCount: p.reviewCount,
    price: p.price,
    comparePrice: p.comparePrice,
    images: p.images,
    thumbnails: p.thumbnails,
    variants: p.variants,
    boostModules: p.boostModules,
    description: p.description,
    shippingInfo: p.shippingInfo,
    returnPolicy: p.returnPolicy,
    socialProof: p.socialProof,
    badge: p.badge ?? null,
  };
}

// ─── Accordion ────────────────────────────────────────────────────────────

function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-4 text-left">
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function SellpagePage() {
  const params = useParams<{ store: string; slug: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const slug = params?.slug ?? '';

  const [product, setProduct] = useState<PageProduct | null>(IS_PREVIEW ? mockProduct(slug) : null);
  const [reviews, setReviews] = useState<ReviewItem[]>(IS_PREVIEW ? MOCK_REVIEWS : []);
  const [loading, setLoading] = useState(!IS_PREVIEW);
  const [error, setError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<MockCartItem[]>([]);
  const [qty, setQty] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'shipping' | 'returns'>('description');

  useEffect(() => {
    if (IS_PREVIEW) return;
    let cancelled = false;

    fetchSellpage(storeSlug, slug)
      .then((data) => {
        if (cancelled) return;
        setProduct(mapApiToProduct(data));
        setReviews(data.reviews ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (IS_PREVIEW) {
          setProduct(mockProduct(slug));
          setReviews(MOCK_REVIEWS);
        } else {
          setError(err.message ?? 'Product not found');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [storeSlug, slug]);

  // Init variant selection when product loads
  useEffect(() => {
    if (!product) return;
    const init: Record<string, string> = {};
    for (const v of product.variants) {
      init[v.name] = v.options[0]?.value ?? '';
    }
    setSelectedVariants(init);
  }, [product]);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="text-6xl font-extrabold text-gray-200 mb-2">404</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Page not found</h1>
        <p className="text-gray-500 mb-6 text-center max-w-md">{error}</p>
        <a
          href={`/${storeSlug}`}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 transition"
        >
          Back to store
        </a>
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const off = Math.round((1 - product.price / product.comparePrice) * 100);

  function handleVariantChange(name: string, value: string) {
    setSelectedVariants(prev => ({ ...prev, [name]: value }));
  }

  function getVariantLabel() {
    return Object.entries(selectedVariants)
      .map(([k, v]) => {
        const variant = product!.variants.find(vr => vr.name === k);
        const opt = variant?.options.find(o => o.value === v);
        return `${k}: ${opt?.label ?? v}`;
      })
      .join(' / ');
  }

  function addToCart() {
    const newItem: MockCartItem = {
      id: `cart_${Date.now()}`,
      productId: product!.id,
      slug: product!.slug,
      name: product!.name,
      image: product!.thumbnails[0] ?? product!.images[0],
      price: product!.price,
      qty,
      variant: getVariantLabel(),
    };
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === product!.id && i.variant === newItem.variant);
      if (existing) {
        return prev.map(i => (i.id === existing.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, newItem];
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PromoBar />
      <StorefrontHeader storeSlug={storeSlug} cartItems={cartItems} onCartUpdate={setCartItems} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <Link href={`/${storeSlug}`} className="hover:text-purple-600 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-gray-700 truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ImageGallery images={product.images} thumbnails={product.thumbnails} name={product.name} />
          </div>

          <div className="space-y-5">
            {product.badge && (
              <span className="inline-block text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                {product.badge}
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>

            <div className="flex items-center flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={`text-sm ${s <= Math.round(product.rating) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">{product.rating}</span>
                <a href="#reviews" className="text-sm text-purple-600 hover:underline">
                  ({product.reviewCount} reviews)
                </a>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Eye size={13} /> {product.socialProof.viewers} viewing</span>
                <span>•</span>
                <span>{product.socialProof.purchased.toLocaleString()} sold</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
              {product.comparePrice > product.price && (
                <span className="text-lg text-gray-400 line-through">${product.comparePrice.toFixed(2)}</span>
              )}
              {off > 0 && (
                <span className="bg-red-100 text-red-600 text-sm font-bold px-2.5 py-1 rounded-full">{off}% OFF</span>
              )}
            </div>

            {product.variants.length > 0 && (
              <VariantSelector variants={product.variants} selected={selectedVariants} onChange={handleVariantChange} />
            )}

            {product.boostModules.length > 0 && <BoostModule modules={product.boostModules} />}

            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Quantity</span>
              <QuantitySelector value={qty} onChange={setQty} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={addToCart}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all ${
                  addedToCart ? 'bg-green-500 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                <ShoppingCart size={18} />
                {addedToCart ? '✓ Added to Cart!' : 'Add to Cart'}
              </button>
              <Link
                href={`/${storeSlug}/${slug}/checkout`}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-semibold text-sm transition-colors"
              >
                <Zap size={16} />
                Buy Now
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
              <span>🚚 Free shipping on orders $50+</span>
              <span>🔄 30-day returns</span>
              <span>🔒 Secure checkout</span>
            </div>
          </div>
        </div>

        <div className="mt-12"><TrustBadges /></div>

        <div className="mt-10 max-w-2xl">
          <div className="flex gap-0 border-b border-gray-200 mb-1">
            {([
              { id: 'description', label: 'Description' },
              { id: 'shipping', label: 'Shipping' },
              { id: 'returns', label: 'Returns' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
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

        <div id="reviews">
          <ReviewSection
            reviews={reviews}
            rating={product.rating}
            reviewCount={product.reviewCount}
            storeSlug={storeSlug}
            productId={product.id}
          />
        </div>
      </main>

      <FloatingCheckoutButton onClick={addToCart} />
      <StorefrontFooter storeSlug={storeSlug} />
    </div>
  );
}
