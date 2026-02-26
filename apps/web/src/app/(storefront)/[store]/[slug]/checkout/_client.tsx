'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Lock, Check, Loader2 } from 'lucide-react';
import { DiscountPicker } from '@/components/storefront/DiscountPicker';

// ─── Lazy-load payment SDKs (~330KB combined) ────────────────────────────────
const StripeCheckout = dynamic(() => import('./_StripeCheckout'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 flex items-center justify-center py-6">
      <Loader2 size={20} className="animate-spin text-gray-400" />
      <span className="ml-2 text-sm text-gray-400">Loading card form...</span>
    </div>
  ),
});

const PayPalCheckout = dynamic(() => import('./_PayPalCheckout'), {
  ssr: false,
  loading: () => (
    <div className="mt-4 flex items-center justify-center py-6">
      <Loader2 size={20} className="animate-spin text-gray-400" />
      <span className="ml-2 text-sm text-gray-400">Loading PayPal...</span>
    </div>
  ),
});
import {
  fetchSellpage,
  submitCheckout,
  confirmPayment,
  type SellpageData,
  type CheckoutResponse,
} from '@/lib/storefrontApi';
import {
  MOCK_PRODUCTS,
  MOCK_CHECKOUT_DISCOUNTS,
  STORE_CONFIG,
  type MockCheckoutDiscount,
} from '@/mock/storefront';
import { storeHref } from '@/lib/storefrontLinks';
import { resolveColor, themeVars } from '@/lib/storeTheme';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ─── Shared types ───────────────────────────────────────────────────────────

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface ProductInfo {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice: number;
  image: string;
  variantLabel: string;
}

interface StoreInfo {
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface ShippingConfig {
  label: string;
  price: number;
  freeThreshold?: number;
}

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard Shipping', sub: '5-7 business days', price: 4.99, threshold: 50 },
  { id: 'express', label: 'Express Shipping', sub: '2-3 business days', price: 12.99 },
  { id: 'overnight', label: 'Overnight', sub: 'Next business day', price: 24.99 },
] as const;

const PAYMENT_METHODS = [
  { id: 'card' as const, label: 'Credit / Debit Card' },
  { id: 'paypal' as const, label: 'PayPal' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapApiDiscounts(discounts: SellpageData['discounts']): MockCheckoutDiscount[] {
  return discounts.map(d => ({
    id: d.id,
    label: d.code,
    description: d.label,
    value: d.label,
    type: d.type === 'PERCENT' ? 'percentage' as const : 'fixed' as const,
    amount: d.value,
  }));
}

// ─── Main checkout form ─────────────────────────────────────────────────────

function CheckoutForm() {
  const params = useParams<{ store: string; slug: string }>();
  const searchParams = useSearchParams();
  const storeSlug = params?.store ?? 'demo-store';
  const slug = params?.slug ?? '';

  // Read URL params reliably from window.location (avoids React closure/Suspense timing issues)
  function getUrlParams() {
    if (typeof window === 'undefined') return { qty: 1, variantId: null as string | null, price: 0, comparePrice: 0, upsellPct: 0, variantLabel: '' };
    const sp = new URLSearchParams(window.location.search);
    return {
      qty: Number(sp.get('qty')) || 1,
      variantId: sp.get('variantId') || null,
      price: Number(sp.get('price')) || 0,
      comparePrice: Number(sp.get('comparePrice')) || 0,
      upsellPct: Number(sp.get('upsellPct')) || 0,
      variantLabel: sp.get('variant') || '',
    };
  }

  // Also read from React hook for reactive display (savings banner etc.)
  const urlUpsellPct = Number(searchParams?.get('upsellPct')) || (typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('upsellPct')) || 0 : 0);

  // Data state
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({ name: '', slug: storeSlug });
  const [discounts, setDiscounts] = useState<MockCheckoutDiscount[]>([]);
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const [loading, setLoading] = useState(!IS_PREVIEW);

  // Form state
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'US',
  });
  const [shipping, setShipping] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [selectedDiscount, setSelectedDiscount] = useState<string | null>(null);
  const [qty] = useState(() => getUrlParams().qty);

  // Payment state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');

  // Stripe confirm function ref
  const [stripeConfirm, setStripeConfirm] = useState<
    ((clientSecret: string) => Promise<string | null>) | null
  >(null);

  // SellpageData for building checkout request (need product.id, variant info)
  const [sellpageData, setSellpageData] = useState<SellpageData | null>(null);

  // ── Fetch data ──
  useEffect(() => {
    if (IS_PREVIEW) {
      const p = MOCK_PRODUCTS.find(mp => mp.slug === slug) ?? MOCK_PRODUCTS[0];
      setProduct({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        comparePrice: p.comparePrice ?? p.price * 2,
        image: p.images[0],
        variantLabel: p.variants[0]?.options[0]?.label ?? '',
      });
      setStoreInfo({ name: STORE_CONFIG.name, slug: STORE_CONFIG.slug, logoUrl: null });
      setDiscounts(MOCK_CHECKOUT_DISCOUNTS);
      return;
    }

    let cancelled = false;
    fetchSellpage(storeSlug, slug)
      .then(data => {
        if (cancelled) return;
        setSellpageData(data);
        // Read URL params directly from window.location inside the callback
        // to avoid stale React closure / Suspense timing issues
        const up = getUrlParams();
        const apiCompare = data.product.compareAtPrice ?? data.product.basePrice * 2;
        setProduct({
          id: data.product.id,
          name: data.sellpage.title,
          slug: data.product.slug,
          price: up.price > 0 ? up.price : data.product.basePrice,
          comparePrice: up.comparePrice > 0 ? up.comparePrice : apiCompare,
          image: data.product.thumbnails[0] ?? data.product.images[0] ?? '',
          variantLabel: up.variantLabel,
        });
        setStoreInfo({ name: data.store.name, slug: data.store.slug, logoUrl: data.store.logoUrl ?? null });
        setDiscounts(mapApiDiscounts(data.discounts));
        setThemeColor((data.sellpage.headerConfig?.primaryColor as string) ?? null);
        // Shipping config from sellpage
        const hdrShipping = data.sellpage.headerConfig?.shipping as ShippingConfig | undefined;
        if (hdrShipping?.label && hdrShipping?.price != null) {
          setShippingConfig(hdrShipping);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback to mock
        const p = MOCK_PRODUCTS.find(mp => mp.slug === slug) ?? MOCK_PRODUCTS[0];
        setProduct({
          id: p.id, name: p.name, slug: p.slug, price: p.price,
          comparePrice: p.comparePrice ?? p.price * 2,
          image: p.images[0], variantLabel: p.variants[0]?.options[0]?.label ?? '',
        });
        setStoreInfo({ name: STORE_CONFIG.name, slug: STORE_CONFIG.slug, logoUrl: null });
        setDiscounts(MOCK_CHECKOUT_DISCOUNTS);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [storeSlug, slug]);

  // ── Pricing ──
  const subtotal = (product?.price ?? 0) * qty;

  // Shipping: use sellpage config if available, otherwise fallback to selected option
  let shippingLabel = '';
  let shippingCost = 0;
  if (shippingConfig) {
    shippingLabel = shippingConfig.label;
    const freeAt = shippingConfig.freeThreshold ?? Infinity;
    shippingCost = subtotal >= freeAt ? 0 : shippingConfig.price;
  } else {
    const shippingOpt = SHIPPING_OPTIONS.find(o => o.id === shipping)!;
    shippingLabel = shippingOpt.label;
    shippingCost = shippingOpt.id === 'standard' && subtotal >= 50 ? 0 : shippingOpt.price;
  }

  const discount = discounts.find(d => d.id === selectedDiscount);
  const discountAmount = discount
    ? discount.type === 'percentage'
      ? (subtotal * discount.amount) / 100
      : discount.amount
    : 0;

  const total = Math.max(0, subtotal + shippingCost - discountAmount);

  // Compare price totals for savings display
  const compareSubtotal = (product?.comparePrice ?? 0) * qty;
  const compareTotal = compareSubtotal + shippingCost;
  const savings = compareTotal - total;
  const hasSavings = savings > 0.01 && urlUpsellPct > 0;

  function updateForm(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validateForm(): string | null {
    if (!form.firstName.trim()) return 'First name is required';
    if (!form.lastName.trim()) return 'Last name is required';
    if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required';
    if (!form.address.trim()) return 'Street address is required';
    if (!form.city.trim()) return 'City is required';
    if (!form.state.trim()) return 'State is required';
    if (!form.zip.trim()) return 'ZIP code is required';
    return null;
  }

  function buildCheckoutRequest(payMethod: 'stripe' | 'paypal') {
    return {
      customerEmail: form.email.trim(),
      customerName: `${form.firstName.trim()} ${form.lastName.trim()}`,
      customerPhone: form.phone.trim() || undefined,
      shippingAddress: {
        street: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        country: form.country,
      },
      shippingMethod: shipping as 'standard' | 'express' | 'overnight',
      items: [{
        productId: product!.id,
        variantId: getUrlParams().variantId ?? sellpageData?.product.variants[0]?.id,
        quantity: qty,
      }],
      discountId: selectedDiscount ?? undefined,
      paymentMethod: payMethod,
      sellpageSlug: slug,
    };
  }

  // ── Stripe card submit ──
  async function handleCardSubmit() {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    if (IS_PREVIEW) {
      setOrderNumber(`ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`);
      setPlaced(true);
      return;
    }

    if (!stripeConfirm) { setError('Stripe not ready. Please wait.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create order + PaymentIntent
      const res = await submitCheckout(storeSlug, buildCheckoutRequest('stripe'));

      if (res.payment.type !== 'stripe') throw new Error('Expected Stripe payment');

      // 2. Confirm with Stripe
      const stripeError = await stripeConfirm(res.payment.clientSecret);
      if (stripeError) throw new Error(stripeError);

      // 3. Confirm on backend
      await confirmPayment(storeSlug, res.orderId, {
        paymentIntentId: res.payment.clientSecret.split('_secret_')[0],
      });

      setOrderNumber(res.orderNumber);
      setPlaced(true);
    } catch (err: any) {
      setError(err.message ?? 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── PayPal createOrder callback ──
  const handlePayPalCreateOrder = useCallback(async (): Promise<string> => {
    const validationError = validateForm();
    if (validationError) throw new Error(validationError);

    const res = await submitCheckout(storeSlug, buildCheckoutRequest('paypal'));
    setOrderId(res.orderId);
    setOrderNumber(res.orderNumber);

    if (res.payment.type !== 'paypal') throw new Error('Expected PayPal payment');
    return res.payment.paypalOrderId;
  }, [form, shipping, selectedDiscount, product, sellpageData, storeSlug, slug, qty]);

  // ── PayPal onApprove callback ──
  const handlePayPalApprove = useCallback(async (data: { orderID: string }) => {
    try {
      setSubmitting(true);
      await confirmPayment(storeSlug, orderId, { paypalOrderId: data.orderID });
      setPlaced(true);
    } catch (err: any) {
      setError(err.message ?? 'PayPal payment confirmation failed.');
    } finally {
      setSubmitting(false);
    }
  }, [storeSlug, orderId]);

  const handleStripeReady = useCallback(
    (fn: (clientSecret: string) => Promise<string | null>) => {
      setStripeConfirm(() => fn);
    },
    [],
  );

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--sp-primary)] focus:border-transparent bg-white transition-shadow';

  // ── Loading ──
  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={themeVars(resolveColor(themeColor))}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--sp-primary)]" />
      </div>
    );
  }

  // ── Success ──
  if (placed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-gray-900" style={themeVars(resolveColor(themeColor))}>
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={36} className="text-green-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-500 mb-1">
            Thank you, <span className="font-medium">{form.firstName || 'Customer'}</span>!
          </p>
          <p className="text-gray-500 text-sm mb-6">
            A confirmation has been sent to{' '}
            <span className="font-medium">{form.email || 'your email'}</span>.
          </p>
          <p className="text-xs text-gray-400 mb-8">
            Order #{orderNumber || `ORD-${Math.floor(100000 + Math.random() * 900000)}`}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={storeHref(storeSlug, '/trackings/search')}
              className="block py-3 bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white font-semibold rounded-2xl transition-colors"
            >
              Track My Order
            </Link>
            <Link
              href={storeHref(storeSlug)}
              className="block py-3 text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout form ──
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={themeVars(resolveColor(themeColor))}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2.5">
            {storeInfo.logoUrl ? (
              <img src={storeInfo.logoUrl} alt={storeInfo.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="font-bold text-lg text-gray-900">{storeInfo.name}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Lock size={12} /> Secure Checkout
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* LEFT: Form */}
          <div className="space-y-6">
            {/* Contact */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                  <input type="text" value={form.firstName} onChange={e => updateForm('firstName', e.target.value)} placeholder="Jane" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input type="text" value={form.lastName} onChange={e => updateForm('lastName', e.target.value)} placeholder="Doe" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="jane@example.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="+1 (555) 000-0000" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Shipping address */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Shipping Address</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
                  <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="123 Main Street, Apt 4B" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                    <input type="text" value={form.city} onChange={e => updateForm('city', e.target.value)} placeholder="New York" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                    <input type="text" value={form.state} onChange={e => updateForm('state', e.target.value)} placeholder="NY" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
                    <input type="text" value={form.zip} onChange={e => updateForm('zip', e.target.value)} placeholder="10001" className={inputCls} />
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping method — fixed if sellpage has config, selectable otherwise */}
            {!shippingConfig && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-bold text-gray-900 mb-4">Shipping Method</h2>
                <div className="space-y-2">
                  {SHIPPING_OPTIONS.map(opt => {
                    const isFree = opt.id === 'standard' && subtotal >= 50;
                    const cost = isFree ? 0 : opt.price;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setShipping(opt.id)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all ${
                          shipping === opt.id
                            ? 'border-[var(--sp-primary)] bg-[var(--sp-primary-light)]'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${shipping === opt.id ? 'border-[var(--sp-primary)]' : 'border-gray-300'}`}>
                            {shipping === opt.id && <div className="w-2 h-2 bg-[var(--sp-primary)] rounded-full" />}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{opt.label}</p>
                            <p className="text-xs text-gray-500">{opt.sub}</p>
                          </div>
                        </div>
                        <span className={`font-semibold ${cost === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {cost === 0 ? 'FREE' : `$${cost.toFixed(2)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Promotions */}
            {discounts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <DiscountPicker
                  discounts={discounts}
                  selected={selectedDiscount}
                  onSelect={setSelectedDiscount}
                />
              </div>
            )}

            {/* Payment method */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Payment Method</h2>
              <div className="space-y-2">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-sm transition-all ${
                      paymentMethod === pm.id
                        ? 'border-[var(--sp-primary)] bg-[var(--sp-primary-light)]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === pm.id ? 'border-[var(--sp-primary)]' : 'border-gray-300'}`}>
                      {paymentMethod === pm.id && <div className="w-2 h-2 bg-[var(--sp-primary)] rounded-full" />}
                    </div>
                    <span className="font-medium text-gray-900">{pm.label}</span>
                  </button>
                ))}
              </div>

              {/* Stripe Card Element (lazy-loaded) */}
              {paymentMethod === 'card' && !IS_PREVIEW && (
                <StripeCheckout onReady={handleStripeReady} />
              )}

              {/* Preview-mode disabled card fields */}
              {paymentMethod === 'card' && IS_PREVIEW && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
                    <input type="text" placeholder="•••• •••• •••• ••••" disabled className={`${inputCls} bg-gray-50 cursor-not-allowed`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expiry</label>
                      <input type="text" placeholder="MM / YY" disabled className={`${inputCls} bg-gray-50 cursor-not-allowed`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                      <input type="text" placeholder="•••" disabled className={`${inputCls} bg-gray-50 cursor-not-allowed`} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock size={10} /> Preview mode — payment is not functional
                  </p>
                </div>
              )}

              {/* PayPal Buttons (lazy-loaded) */}
              {paymentMethod === 'paypal' && !IS_PREVIEW && (
                <PayPalCheckout
                  createOrder={handlePayPalCreateOrder}
                  onApprove={handlePayPalApprove}
                  onError={(err) => setError(String(err))}
                  disabled={submitting}
                />
              )}

              {paymentMethod === 'paypal' && IS_PREVIEW && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
                  <p className="text-sm text-yellow-700 font-medium">PayPal Sandbox</p>
                  <p className="text-xs text-yellow-600 mt-1">Preview mode — PayPal is not functional</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Order summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-6">
              <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>

              {/* Savings banner */}
              {hasSavings && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4">
                  <p className="text-sm font-semibold text-green-700">
                    Nice! You saved <span className="font-bold">${savings.toFixed(2)}</span> on this order!
                  </p>
                </div>
              )}

              {/* Product */}
              <div className="flex gap-3 mb-5 pb-4 border-b border-gray-100">
                <div className="relative w-16 h-16 flex-shrink-0">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-xl bg-gray-100"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                  {product.variantLabel && (
                    <p className="text-xs text-gray-500 mt-0.5">{product.variantLabel}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-semibold text-[var(--sp-primary)]">Quantity: {qty}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {product.comparePrice > product.price && (
                    <span className="text-xs text-gray-400 line-through block">${product.comparePrice.toFixed(2)}</span>
                  )}
                  <span className="text-sm font-bold text-gray-900">${product.price.toFixed(2)}</span>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{shippingLabel || 'Shipping'}</span>
                  <span className={shippingCost === 0 ? 'text-green-600 font-medium' : ''}>
                    {shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>--</span>
                </div>
                {discount && discountAmount > 0 && (
                  <div className="flex justify-between text-[var(--sp-primary-hover)] font-medium">
                    <span>{discount.label}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-3 mt-3">
                  <span>Total</span>
                  <span className="flex items-center gap-2">
                    {hasSavings && (
                      <span className="text-sm text-gray-400 line-through font-normal">${compareTotal.toFixed(2)}</span>
                    )}
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Place order (card only — PayPal has its own button) */}
              {paymentMethod === 'card' && (
                <button
                  onClick={handleCardSubmit}
                  disabled={submitting}
                  className="mt-5 w-full py-3.5 bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] disabled:opacity-60 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Lock size={15} />
                  )}
                  {submitting ? 'Processing...' : `Place Order — $${total.toFixed(2)}`}
                </button>
              )}

              {paymentMethod === 'paypal' && (
                <p className="mt-5 text-xs text-gray-400 text-center">
                  Click the PayPal button above to complete your order
                </p>
              )}

              <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
                By placing your order, you agree to our{' '}
                <Link href={storeHref(storeSlug, '/pages/terms')} className="underline hover:text-gray-600">Terms</Link>{' '}
                and{' '}
                <Link href={storeHref(storeSlug, '/pages/privacy')} className="underline hover:text-gray-600">Privacy Policy</Link>.
              </p>

              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 mb-2">All transactions are secure and encrypted</p>
                <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                  <span>🔒 SSL Encrypted</span>
                  <span>·</span>
                  <span>📦 Track your order</span>
                  <span>·</span>
                  <span>↩️ 30-day returns</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper (providers are now inside lazy-loaded components) ───────────────

export default function CheckoutPage() {
  return <CheckoutForm />;
}
