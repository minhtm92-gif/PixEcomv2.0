'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Check } from 'lucide-react';
import {
  MOCK_PRODUCTS,
  MOCK_CHECKOUT_DISCOUNTS,
  STORE_CONFIG,
} from '@/mock/storefront';
import { DiscountPicker } from '@/components/storefront/DiscountPicker';

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

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Standard Shipping', sub: '5-7 business days', price: 0, threshold: 50 },
  { id: 'express', label: 'Express Shipping', sub: '2-3 business days', price: 12.99 },
  { id: 'overnight', label: 'Overnight', sub: 'Next business day', price: 24.99 },
];

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / Debit Card' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'applepay', label: 'Apple Pay' },
];

export default function CheckoutPage() {
  const params = useParams<{ store: string; slug: string }>();
  const storeSlug = params?.store ?? 'demo-store';
  const slug = params?.slug ?? '';

  const product = MOCK_PRODUCTS.find(p => p.slug === slug) ?? MOCK_PRODUCTS[0];

  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });

  const [shipping, setShipping] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [selectedDiscount, setSelectedDiscount] = useState<string | null>(null);
  const [qty] = useState(1);
  const [placed, setPlaced] = useState(false);

  function updateForm(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const shippingOpt = SHIPPING_OPTIONS.find(o => o.id === shipping)!;
  const subtotal = product.price * qty;
  const shippingCost =
    shippingOpt.id === 'standard' && subtotal >= STORE_CONFIG.shippingThreshold
      ? 0
      : shippingOpt.price;

  const discount = MOCK_CHECKOUT_DISCOUNTS.find(d => d.id === selectedDiscount);
  const discountAmount = discount
    ? discount.type === 'percentage'
      ? (subtotal * discount.amount) / 100
      : discount.amount
    : 0;

  const total = Math.max(0, subtotal + shippingCost - discountAmount);

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white transition-shadow';

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
            Order #LC-{Math.floor(100000 + Math.random() * 900000)}
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
          <span className="font-bold text-lg text-gray-900">{STORE_CONFIG.name}</span>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => updateForm('firstName', e.target.value)}
                    placeholder="Jane"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => updateForm('lastName', e.target.value)}
                    placeholder="Doe"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => updateForm('email', e.target.value)}
                    placeholder="jane@example.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => updateForm('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Shipping address */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Shipping Address</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => updateForm('address', e.target.value)}
                    placeholder="123 Main Street, Apt 4B"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => updateForm('city', e.target.value)}
                      placeholder="New York"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={e => updateForm('state', e.target.value)}
                      placeholder="NY"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      ZIP
                    </label>
                    <input
                      type="text"
                      value={form.zip}
                      onChange={e => updateForm('zip', e.target.value)}
                      placeholder="10001"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping method */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">Shipping Method</h2>
              <div className="space-y-2">
                {SHIPPING_OPTIONS.map(opt => {
                  const isFree =
                    opt.id === 'standard' &&
                    subtotal >= STORE_CONFIG.shippingThreshold;
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
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            shipping === opt.id
                              ? 'border-purple-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {shipping === opt.id && (
                            <div className="w-2 h-2 bg-purple-600 rounded-full" />
                          )}
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <DiscountPicker
                discounts={MOCK_CHECKOUT_DISCOUNTS}
                selected={selectedDiscount}
                onSelect={setSelectedDiscount}
              />
            </div>

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
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        paymentMethod === pm.id ? 'border-purple-600' : 'border-gray-300'
                      }`}
                    >
                      {paymentMethod === pm.id && (
                        <div className="w-2 h-2 bg-purple-600 rounded-full" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900">{pm.label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'card' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="•••• •••• •••• ••••"
                      disabled
                      className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Expiry
                      </label>
                      <input
                        type="text"
                        placeholder="MM / YY"
                        disabled
                        className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        CVC
                      </label>
                      <input
                        type="text"
                        placeholder="•••"
                        disabled
                        className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock size={10} /> Payment fields are for preview — not functional
                  </p>
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
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-xl bg-gray-100"
                  />
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {qty}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{product.variants[0]?.options[0]?.label ?? ''}</p>
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

              {/* Place order */}
              <button
                onClick={() => setPlaced(true)}
                className="mt-5 w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <Lock size={15} />
                Place Order — ${total.toFixed(2)}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3 leading-relaxed">
                By placing your order, you agree to our{' '}
                <Link
                  href={`/${storeSlug}/pages/terms`}
                  className="underline hover:text-gray-600"
                >
                  Terms
                </Link>{' '}
                and{' '}
                <Link
                  href={`/${storeSlug}/pages/privacy`}
                  className="underline hover:text-gray-600"
                >
                  Privacy Policy
                </Link>
                .
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
