'use client';

import { useState, useEffect, useRef } from 'react';
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
import { BoostModule, computeUpsellPrice } from '@/components/storefront/BoostModule';
import { QuantitySelector } from '@/components/storefront/QuantitySelector';
import { TrustBadges } from '@/components/storefront/TrustBadges';
import { ReviewSection, type ReviewItem } from '@/components/storefront/ReviewSection';
import { FloatingCheckoutButton } from '@/components/storefront/FloatingCheckoutButton';
import { StickyDesktopCTA } from '@/components/storefront/StickyDesktopCTA';
import { fetchSellpage, type SellpageData, type SellpageVariant } from '@/lib/storefrontApi';
import { storeHref } from '@/lib/storefrontLinks';
import { resolveColor, themeVars } from '@/lib/storeTheme';
import type { GuaranteeConfig } from '@/types/storefront';

declare global {
  interface Window { fbq: any; _fbq: any; }
}

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

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
  allowOutOfStockPurchase: boolean;
}

// Convert DB variants (rows with options: { color: 'gold', size: 'M' })
// into the MockVariant[] format: [{ name: 'Color', options: [...] }]
function reshapeVariants(dbVariants: SellpageVariant[], allowOutOfStockPurchase = false): MockVariant[] {
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
          available: v.isActive && (v.stockQuantity > 0 || allowOutOfStockPurchase),
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
    variants: reshapeVariants(data.product.variants, data.product.allowOutOfStockPurchase),
    boostModules: (data.sellpage.boostModules ?? []) as MockBoostModule[],
    description: data.product.description || data.sellpage.description,
    shippingInfo:
      typeof data.product.shippingInfo === 'string'
        ? data.product.shippingInfo
        : 'Ships in 1-2 business days. Free shipping on orders over $50.',
    returnPolicy: '30-day hassle-free returns.',
    socialProof: data.socialProof,
    badge: null,
    allowOutOfStockPurchase: data.product.allowOutOfStockPurchase ?? false,
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
    allowOutOfStockPurchase: false,
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

// Helper: apply SellpageData to all state setters at once
function applyData(
  data: SellpageData,
  setProduct: (p: PageProduct) => void,
  setRawVariants: (v: SellpageVariant[]) => void,
  setReviews: (r: ReviewItem[]) => void,
  setStoreName: (n: string | undefined) => void,
  setLogoUrl: (u: string | null) => void,
  setThemeColor: (c: string | null) => void,
  setGuaranteeConfig: (g: GuaranteeConfig | undefined) => void,
) {
  setProduct(mapApiToProduct(data));
  setRawVariants(data.product.variants);
  setReviews(data.reviews ?? []);
  setStoreName(data.store?.name);
  setLogoUrl(data.store?.logoUrl ?? null);
  setThemeColor((data.sellpage.headerConfig?.primaryColor as string) ?? null);
  if (data.sellpage.headerConfig?.guarantees) {
    setGuaranteeConfig(data.sellpage.headerConfig.guarantees as GuaranteeConfig);
  }
}

interface SellpagePageProps {
  initialData?: SellpageData | null;
}

export default function SellpagePage({ initialData }: SellpagePageProps) {
  const params = useParams<{ store: string; slug: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const slug = params?.slug ?? '';

  // Determine if we can hydrate from server-fetched data immediately
  const hasServerData = !IS_PREVIEW && !!initialData;

  const [product, setProduct] = useState<PageProduct | null>(
    IS_PREVIEW ? mockProduct(slug) : hasServerData ? mapApiToProduct(initialData!) : null,
  );
  const [reviews, setReviews] = useState<ReviewItem[]>(
    IS_PREVIEW ? MOCK_REVIEWS : hasServerData ? (initialData!.reviews ?? []) : [],
  );
  const [storeName, setStoreName] = useState<string | undefined>(
    hasServerData ? initialData!.store?.name : undefined,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(
    hasServerData ? (initialData!.store?.logoUrl ?? null) : null,
  );
  const [themeColor, setThemeColor] = useState<string | null>(
    hasServerData ? ((initialData!.sellpage.headerConfig?.primaryColor as string) ?? null) : null,
  );
  const [guaranteeConfig, setGuaranteeConfig] = useState<GuaranteeConfig | undefined>(
    hasServerData && initialData!.sellpage.headerConfig?.guarantees
      ? (initialData!.sellpage.headerConfig.guarantees as GuaranteeConfig)
      : undefined,
  );
  const [rawVariants, setRawVariants] = useState<SellpageVariant[]>(
    hasServerData ? initialData!.product.variants : [],
  );
  const [trackingPixelId, setTrackingPixelId] = useState<string | null>(
    hasServerData ? (initialData!.tracking?.pixelId ?? null) : null,
  );
  const [loading, setLoading] = useState(!IS_PREVIEW && !hasServerData);
  const [error, setError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<MockCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [userChangedVariant, setUserChangedVariant] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'shipping' | 'returns'>('description');
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip fetch if preview mode OR we already have server-provided data
    if (IS_PREVIEW || hasServerData) return;

    let cancelled = false;

    fetchSellpage(storeSlug, slug)
      .then((data) => {
        if (cancelled) return;
        applyData(data, setProduct, setRawVariants, setReviews, setStoreName, setLogoUrl, setThemeColor, setGuaranteeConfig);
        setTrackingPixelId(data.tracking?.pixelId ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? 'Product not found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [storeSlug, slug, hasServerData]);

  // Init variant selection when product loads
  useEffect(() => {
    if (!product) return;
    const init: Record<string, string> = {};
    for (const v of product.variants) {
      init[v.name] = v.options[0]?.value ?? '';
    }
    setSelectedVariants(init);
  }, [product]);

  // Meta Pixel: inject fbq script when pixelId is available
  useEffect(() => {
    const pixelId = trackingPixelId;
    if (!pixelId || typeof window === 'undefined') return;
    if (window.fbq) return; // Already loaded

    !function(f: any,b: any,e: any,v: any,n?: any,t?: any,s?: any){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }, [trackingPixelId]);

  // Meta Pixel: fire ViewContent when product loads
  useEffect(() => {
    if (!trackingPixelId || !product) return;
    window.fbq?.('track', 'ViewContent', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: product.price,
      currency: 'USD',
    });
  }, [product?.id, trackingPixelId]);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="text-6xl font-extrabold text-gray-200 mb-2">404</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Page not found</h1>
        <p className="text-gray-500 mb-6 text-center max-w-md">{error}</p>
        <a
          href={storeHref(storeSlug)}
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
        <Loader2 className="w-8 h-8 animate-spin text-[var(--sp-primary)]" />
      </div>
    );
  }

  // Compute upsell discount based on qty and compare price
  const upsellResult = computeUpsellPrice(product.boostModules, qty, product.comparePrice);
  const effectivePrice = upsellResult ? upsellResult.effectivePrice : product.price;
  const off = Math.round((1 - effectivePrice / product.comparePrice) * 100);

  // Find the matching raw variant for the current selection → extract its image + ID
  const matchedVariant = (() => {
    if (rawVariants.length === 0 || Object.keys(selectedVariants).length === 0) return null;
    return rawVariants.find(rv => {
      const opts = rv.options as Record<string, string>;
      return Object.entries(selectedVariants).every(
        ([key, val]) => opts[key.toLowerCase()] === val || opts[key] === val,
      );
    }) ?? null;
  })();
  // Only show variant image after user manually changes a variant option —
  // on initial page load we always show the hero product image.
  const variantImage = userChangedVariant ? (matchedVariant?.image ?? null) : null;

  // Build checkout URL with qty, variant, price, and compare price info
  const checkoutParams = new URLSearchParams();
  checkoutParams.set('qty', String(qty));
  if (matchedVariant) checkoutParams.set('variantId', matchedVariant.id);
  checkoutParams.set('price', String(effectivePrice));
  checkoutParams.set('comparePrice', String(product.comparePrice));
  if (upsellResult) checkoutParams.set('upsellPct', String(upsellResult.discountPct));
  // Pass variant label for display in checkout
  const varLabel = Object.entries(selectedVariants)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v.charAt(0).toUpperCase() + v.slice(1)}`)
    .join('  ');
  if (varLabel) checkoutParams.set('variant', varLabel);
  // UTM passthrough + pixelId for checkout
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(key => {
      const val = urlParams.get(key);
      if (val) checkoutParams.set(key, val);
    });
  }
  if (trackingPixelId) checkoutParams.set('pixelId', trackingPixelId);
  const checkoutUrl = storeHref(storeSlug, `/${slug}/checkout?${checkoutParams.toString()}`);

  function handleVariantChange(name: string, value: string) {
    setSelectedVariants(prev => ({ ...prev, [name]: value }));
    setUserChangedVariant(true);
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
      slug: slug, // sellpage slug from URL (not product.slug)
      name: product!.name,
      image: product!.thumbnails[0] ?? product!.images[0],
      price: effectivePrice,
      comparePrice: product!.comparePrice,
      qty,
      variant: getVariantLabel(),
      variantId: matchedVariant?.id,
      upsellPct: upsellResult?.discountPct,
    };
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === product!.id && i.variant === newItem.variant);
      if (existing) {
        return prev.map(i => (i.id === existing.id ? { ...i, qty: i.qty + qty, price: effectivePrice, comparePrice: product!.comparePrice, upsellPct: upsellResult?.discountPct } : i));
      }
      return [...prev, newItem];
    });
    setAddedToCart(true);
    setCartOpen(true);
    setTimeout(() => setAddedToCart(false), 2000);

    // Meta Pixel: AddToCart event
    window.fbq?.('track', 'AddToCart', {
      content_ids: [product!.id],
      content_name: product!.name,
      content_type: 'product',
      value: effectivePrice * qty,
      currency: 'USD',
      num_items: qty,
    });
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={themeVars(resolveColor(themeColor))}>
      <PromoBar />
      <StorefrontHeader
        storeSlug={storeSlug}
        storeName={storeName}
        logoUrl={logoUrl}
        cartItems={cartItems}
        onCartUpdate={setCartItems}
        cartOpen={cartOpen}
        onCartOpenChange={setCartOpen}
        boostModules={product.boostModules}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-1.5">
          <Link href={storeHref(storeSlug)} className="hover:text-[var(--sp-primary)] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-gray-700 truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ImageGallery images={product.images} thumbnails={product.thumbnails} name={product.name} variantImage={variantImage} />
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
                <a href="#reviews" className="text-sm text-[var(--sp-primary)] hover:underline">
                  ({product.reviewCount} reviews)
                </a>
              </div>
              {(product.socialProof.viewers > 0 || product.socialProof.purchased > 0) && (
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {product.socialProof.viewers > 0 && (
                    <span className="flex items-center gap-1"><Eye size={13} /> {product.socialProof.viewers} viewing</span>
                  )}
                  {product.socialProof.viewers > 0 && product.socialProof.purchased > 0 && <span>•</span>}
                  {product.socialProof.purchased > 0 && (
                    <span>{product.socialProof.purchased.toLocaleString()} sold</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-bold text-gray-900">${effectivePrice.toFixed(2)}</span>
              {effectivePrice < product.price && (
                <span className="text-lg text-gray-400 line-through">${product.price.toFixed(2)}</span>
              )}
              {product.comparePrice > effectivePrice && (
                <span className="text-lg text-gray-400 line-through">${product.comparePrice.toFixed(2)}</span>
              )}
              {upsellResult ? (
                <span className="bg-green-100 text-green-700 text-sm font-bold px-2.5 py-1 rounded-full">
                  {off}% OFF
                </span>
              ) : off > 0 ? (
                <span className="bg-red-100 text-red-600 text-sm font-bold px-2.5 py-1 rounded-full">
                  {off}% OFF
                </span>
              ) : null}
            </div>

            {product.variants.length > 0 && (
              <VariantSelector variants={product.variants} selected={selectedVariants} onChange={handleVariantChange} />
            )}

            {/* Stock urgency indicator */}
            {(() => {
              const stock = matchedVariant?.stockQuantity;
              if (stock === undefined || stock === null) return null;
              if (stock === 0 && !product.allowOutOfStockPurchase) {
                return (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                    Out of stock
                  </span>
                );
              }
              if (stock === 0 && product.allowOutOfStockPurchase) {
                return (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                    In stock — ready to ship
                  </span>
                );
              }
              if (stock >= 1 && stock <= 10) {
                return (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                    Only {stock} left in stock — order soon!
                  </span>
                );
              }
              return null;
            })()}

            {product.boostModules.length > 0 && <BoostModule modules={product.boostModules} qty={qty} />}

            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Quantity</span>
              <QuantitySelector value={qty} onChange={setQty} />
            </div>

            <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 pt-1">
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
                href={checkoutUrl}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white rounded-2xl font-semibold text-sm transition-colors"
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

        <div className="mt-12"><TrustBadges config={guaranteeConfig} /></div>

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
                  activeTab === tab.id ? 'border-[var(--sp-primary)] text-[var(--sp-primary-hover)]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="py-5 text-sm text-gray-600 leading-relaxed">
            {activeTab === 'description' && (
              isHtml(product.description)
                ? <div className="rich-description [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_p]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_a]:text-[var(--sp-primary)] [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:p-2 [&_th]:border [&_th]:border-gray-200 [&_th]:p-2 [&_th]:bg-gray-50" dangerouslySetInnerHTML={{ __html: product.description }} />
                : <div className="whitespace-pre-line">{product.description}</div>
            )}
            {activeTab === 'shipping' && (
              typeof product.shippingInfo === 'string' && isHtml(product.shippingInfo)
                ? <div className="rich-description [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_p]:mb-3 [&_a]:text-[var(--sp-primary)] [&_a]:underline" dangerouslySetInnerHTML={{ __html: product.shippingInfo }} />
                : <div className="whitespace-pre-line">{product.shippingInfo}</div>
            )}
            {activeTab === 'returns' && <div className="whitespace-pre-line">{product.returnPolicy}</div>}
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
      <StickyDesktopCTA
        price={effectivePrice}
        comparePrice={product.comparePrice}
        onBuyNow={() => { window.location.href = checkoutUrl; }}
        ctaRef={ctaRef}
      />
      <StorefrontFooter storeSlug={storeSlug} />
    </div>
  );
}
