'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Check, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { DiscountPicker } from '@/components/storefront/DiscountPicker';
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

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

const stripePromise = IS_PREVIEW
  ? null
  : loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';

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
  image: string;
  variantLabel: string;
}

interface StoreInfo {
  name: string;
  slug: string;
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

// ─── Card form (needs Stripe hooks) ─────────────────────────────────────────

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#1f2937',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
};

function StripeCardForm({
  onReady,
}: {
  onReady: (confirm: (clientSecret: string) => Promise<string | null>) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return;

    // Expose the confirm function to the parent
    onReady(async (clientSecret: string) => {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) return 'Card element not found';

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) return error.message ?? 'Payment failed';
      if (paymentIntent?.status === 'succeeded') return null; // success
      return `Payment status: ${paymentIntent?.status}`;
    });
  }, [stripe, elements, onReady]);

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Card Details</label>
        <div className="px-3 py-3 border border-gray-200 rounded-xl bg-white">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Lock size={10} /> Secured by Stripe — we never see your card details
      </p>
    </div>
  );
}

// ─── Main checkout form ─────────────────────────────────────────────────────

function CheckoutForm() {
  const params = useParams<{ store: string; slug: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const slug = params?.slug ?? '';

  // Data state
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({ name: '', slug: storeSlug });
  const [discounts, setDiscounts] = useState<MockCheckoutDiscount[]>([]);
  const [loading, setLoading] = useState(!IS_PREVIEW);

  // Form state
  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: 'US',
  });
  const [shipping, setShipping] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [selectedDiscount, setSelectedDiscount] = useState<string | null>(null);
  const [qty] = useState(1);

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
        image: p.images[0],
        variantLabel: p.variants[0]?.options[0]?.label ?? '',
      });
      setStoreInfo({ name: STORE_CONFIG.name, slug: STORE_CONFIG.slug });
      setDiscounts(MOCK_CHECKOUT_DISCOUNTS);
      return;
    }

    let cancelled = false;
    fetchSellpage(storeSlug, slug)
      .then(data => {
        if (cancelled) return;
        setSellpageData(data);
        setProduct({
          id: data.product.id,
          name: data.sellpage.title,
          slug: data.product.slug,
          price: data.product.basePrice,
          image: data.product.thumbnails[0] ?? data.product.images[0] ?? '',
          variantLabel: '',
        });
        setStoreInfo({ name: data.store.name, slug: data.store.slug });
        setDiscounts(mapApiDiscounts(data.discounts));
      })
      .catch(() => {
        if (cancelled) return;
        // Fallback to mock
        const p = MOCK_PRODUCTS.find(mp => mp.slug === slug) ?? MOCK_PRODUCTS[0];
        setProduct({
          id: p.id, name: p.name, slug: p.slug, price: p.price,
          image: p.images[0], variantLabel: p.variants[0]?.options[0]?.label ?? '',
        });
        setStoreInfo({ name: STORE_CONFIG.name, slug: STORE_CONFIG.slug });
        setDiscounts(MOCK_CHECKOUT_DISCOUNTS);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [storeSlug, slug]);

  // ── Pricing ──
  const shippingOpt = SHIPPING_OPTIONS.find(o => o.id === shipping)!;
  const subtotal = (product?.price ?? 0) * qty;
  const shippingCost =
    shippingOpt.id === 'standard' && subtotal >= 50 ? 0 : shippingOpt.price;

  const discount = discounts.find(d => d.id === selectedDiscount);
  const discountAmount = discount
    ? discount.type === 'percentage'
      ? (subtotal * discount.amount) / 100
      : discount.amount
    : 0;

  const total = Math.max(0, subtotal + shippingCost - discountAmount);

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
        variantId: sellpageData?.product.variants[0]?.id,
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
    'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white transition-shadow';

  // ── Loading ──
  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // ── Success ──
  if (placed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-gray-900">
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
              href={`/${storeSlug}/trackings/search`}
              className="block py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-2xl transition-colors"
            >
              Track My Order
            </Link>
            <Link
              href={`/${storeSlug}`}
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={`/${storeSlug}/${slug}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <span className="font-bold text-lg text-gray-900">{storeInfo.name}</span>
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

            {/* Shipping method */}
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
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${shipping === opt.id ? 'border-purple-600' : 'border-gray-300'}`}>
                          {shipping === opt.id && <div className="w-2 h-2 bg-purple-600 rounded-full" />}
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
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === pm.id ? 'border-purple-600' : 'border-gray-300'}`}>
                      {paymentMethod === pm.id && <div className="w-2 h-2 bg-purple-600 rounded-full" />}
                    </div>
                    <span className="font-medium text-gray-900">{pm.label}</span>
                  </button>
                ))}
              </div>

              {/* Stripe Card Element */}
              {paymentMethod === 'card' && !IS_PREVIEW && (
                <StripeCardForm onReady={handleStripeReady} />
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

              {/* PayPal Buttons */}
              {paymentMethod === 'paypal' && !IS_PREVIEW && (
                <div className="mt-4">
                  <PayPalButtons
                    style={{ layout: 'vertical', shape: 'pill', label: 'pay' }}
                    createOrder={handlePayPalCreateOrder}
                    onApprove={handlePayPalApprove}
                    onError={(err) => setError(String(err))}
                    disabled={submitting}
                  />
                </div>
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
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {qty}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                  {product.variantLabel && (
                    <p className="text-xs text-gray-400 mt-0.5">{product.variantLabel}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-gray-900">
                  ${(product.price * qty).toFixed(2)}
                </span>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className={shippingCost === 0 ? 'text-green-600 font-medium' : ''}>
                    {shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                {discount && discountAmount > 0 && (
                  <div className="flex justify-between text-purple-700 font-medium">
                    <span>{discount.label}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-3 mt-3">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
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
                  className="mt-5 w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
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
                <Link href={`/${storeSlug}/pages/terms`} className="underline hover:text-gray-600">Terms</Link>{' '}
                and{' '}
                <Link href={`/${storeSlug}/pages/privacy`} className="underline hover:text-gray-600">Privacy Policy</Link>.
              </p>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-3 text-xs text-gray-400">
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
  );
}

// ─── Wrapper with providers ─────────────────────────────────────────────────

export default function CheckoutPage() {
  if (IS_PREVIEW) {
    return <CheckoutForm />;
  }

  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD' }}>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </PayPalScriptProvider>
  );
}
