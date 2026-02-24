'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Truck, CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { trackOrder, type OrderTrackingData } from '@/lib/storefrontApi';
import { STORE_CONFIG } from '@/mock/storefront';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

const MOCK_TRACKING: OrderTrackingData = {
  orderNumber: 'LC-847291',
  status: 'SHIPPED',
  customerName: 'Jane Doe',
  total: 49.99,
  currency: 'USD',
  trackingNumber: '9400111899223454123456',
  trackingUrl: null,
  shippingAddress: { street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' },
  createdAt: '2026-02-23T10:34:00Z',
  items: [
    { productName: 'Lynsie Charm Bracelet Set', variantName: 'Gold / Standard', quantity: 1, unitPrice: 49.99, lineTotal: 49.99 },
  ],
  timeline: [
    { type: 'CREATED', description: 'Order placed', at: '2026-02-23T10:34:00Z' },
    { type: 'CONFIRMED', description: 'Payment confirmed', at: '2026-02-23T11:05:00Z' },
    { type: 'SHIPPED', description: 'Shipped via USPS', at: '2026-02-24T14:18:00Z' },
  ],
};

// Map order event types to UI config
function getTimelineIcon(type: string) {
  switch (type) {
    case 'CREATED': return { Icon: Package, label: 'Order Placed' };
    case 'CONFIRMED': return { Icon: CheckCircle, label: 'Payment Confirmed' };
    case 'SHIPPED': return { Icon: Truck, label: 'Shipped' };
    case 'DELIVERED': return { Icon: CheckCircle, label: 'Delivered' };
    case 'CANCELLED': return { Icon: AlertCircle, label: 'Cancelled' };
    case 'REFUNDED': return { Icon: AlertCircle, label: 'Refunded' };
    default: return { Icon: Clock, label: type };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' — ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-700';
    case 'CONFIRMED': return 'bg-blue-100 text-blue-700';
    case 'SHIPPED': return 'bg-blue-100 text-blue-700';
    case 'DELIVERED': return 'bg-green-100 text-green-700';
    case 'CANCELLED': return 'bg-red-100 text-red-700';
    case 'REFUNDED': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export default function TrackingSearchPage() {
  const params = useParams<{ store: string }>();
  const storeSlug = params?.store ?? 'demo-store';

  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<OrderTrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const num = orderNumberInput.trim();
    const em = emailInput.trim();
    if (!num || !em) return;

    if (IS_PREVIEW) {
      setSearched(true);
      setResult(MOCK_TRACKING);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const data = await trackOrder(storeSlug, num, em);
      setResult(data);
      setSearched(true);
    } catch (err: any) {
      setResult(null);
      setSearched(true);
      setError(err.message ?? 'Order not found');
    } finally {
      setSearching(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white transition-shadow';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href={`/${storeSlug}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Shop
          </Link>
          <span className="font-bold text-lg text-gray-900">{STORE_CONFIG.name}</span>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
          <p className="text-sm text-gray-500 mt-2">
            Enter your order number and email to see your delivery status
          </p>
        </div>

        {/* Search form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Order Number
              </label>
              <input
                type="text"
                value={orderNumberInput}
                onChange={e => setOrderNumberInput(e.target.value)}
                placeholder="e.g. ORD-20260224-1234"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="The email used to place your order"
                className={inputCls}
                required
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : null}
              {searching ? 'Searching...' : 'Track Order'}
            </button>
          </form>
        </div>

        {/* Not Found */}
        {searched && !result && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 text-center">
            <p className="text-red-500 font-semibold mb-1">Order Not Found</p>
            <p className="text-sm text-gray-500">
              {error || 'No order found for the details provided. Please check your order confirmation email and try again.'}
            </p>
          </div>
        )}

        {/* Result */}
        {searched && result && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Order header */}
            <div className="flex items-start justify-between mb-5 pb-5 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Order</p>
                <p className="font-bold text-gray-900">#{result.orderNumber}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {result.items.map(i => i.productName).join(', ')}
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusColor(result.status)}`}>
                {result.status}
              </span>
            </div>

            {/* Order details */}
            <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-semibold text-gray-900">${result.total.toFixed(2)} {result.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Items</span>
                <span className="text-gray-900">{result.items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ordered</span>
                <span className="text-gray-900">{formatDate(result.createdAt)}</span>
              </div>
            </div>

            {/* Tracking info */}
            {result.trackingNumber && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-5 flex items-center gap-3">
                <Truck size={18} className="text-purple-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    Tracking: {result.trackingNumber}
                  </p>
                  {result.trackingUrl && (
                    <a
                      href={result.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:underline font-medium"
                    >
                      Track with carrier →
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Items list */}
            <div className="mb-5 pb-5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Items</p>
              <div className="space-y-2">
                {result.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-900 font-medium">{item.productName}</span>
                      {item.variantName && (
                        <span className="text-gray-400 ml-1">· {item.variantName}</span>
                      )}
                      <span className="text-gray-400 ml-1">× {item.quantity}</span>
                    </div>
                    <span className="font-semibold text-gray-900">${item.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Order Timeline</p>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-5">
                {result.timeline.map((step, i) => {
                  const { Icon, label } = getTimelineIcon(step.type);
                  return (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-purple-600 text-white">
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        {step.description && (
                          <p className="text-xs text-gray-500">{step.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(step.at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Help */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Need help?{' '}
                <a href="mailto:support@pixecom.store" className="text-purple-600 hover:underline">
                  Contact support
                </a>
              </p>
            </div>
          </div>
        )}

        {IS_PREVIEW && (
          <p className="text-xs text-center text-gray-400 mt-6">
            Preview: enter any order number + email to see mock tracking result
          </p>
        )}
      </main>
    </div>
  );
}
