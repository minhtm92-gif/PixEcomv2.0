'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { STORE_CONFIG } from '@/mock/storefront';

const MOCK_TRACKING = {
  orderNumber: 'LC-847291',
  status: 'SHIPPED',
  product: 'Lynsie Charm Bracelet Set',
  estimatedDelivery: 'Feb 28, 2026',
  carrier: 'USPS',
  trackingNumber: '9400111899223454123456',
  timeline: [
    {
      status: 'Order Placed',
      date: 'Feb 23, 2026 — 10:34 AM',
      done: true,
      icon: CheckCircle,
    },
    {
      status: 'Order Confirmed',
      date: 'Feb 23, 2026 — 11:05 AM',
      done: true,
      icon: CheckCircle,
    },
    {
      status: 'Shipped — USPS',
      date: 'Feb 24, 2026 — 2:18 PM',
      done: true,
      icon: Truck,
    },
    {
      status: 'Out for Delivery',
      date: 'Estimated Feb 28, 2026',
      done: false,
      icon: Truck,
    },
    {
      status: 'Delivered',
      date: 'Estimated Feb 28, 2026',
      done: false,
      icon: CheckCircle,
    },
  ],
};

export default function TrackingSearchPage() {
  const params = useParams<{ store: string }>();
  const storeSlug = params?.store ?? 'demo-store';

  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [searched, setSearched] = useState(false);
  const [found, setFound] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
    // Show mock result for any non-empty input
    setFound(orderNumber.trim().length > 0 && email.trim().length > 0);
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
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="e.g. LC-847291"
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
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="The email used to place your order"
                className={inputCls}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
            >
              Track Order
            </button>
          </form>
        </div>

        {/* Result */}
        {searched && !found && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 text-center">
            <p className="text-red-500 font-semibold mb-1">Order Not Found</p>
            <p className="text-sm text-gray-500">
              No order found for the details provided. Please check your order confirmation
              email and try again.
            </p>
          </div>
        )}

        {searched && found && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Order header */}
            <div className="flex items-start justify-between mb-5 pb-5 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Order</p>
                <p className="font-bold text-gray-900">#{MOCK_TRACKING.orderNumber}</p>
                <p className="text-sm text-gray-500 mt-1">{MOCK_TRACKING.product}</p>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                {MOCK_TRACKING.status}
              </span>
            </div>

            {/* Carrier info */}
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-5 flex items-center gap-3">
              <Truck size={18} className="text-purple-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {MOCK_TRACKING.carrier} · {MOCK_TRACKING.trackingNumber}
                </p>
                <p className="text-purple-600 font-medium">
                  Estimated delivery: {MOCK_TRACKING.estimatedDelivery}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-5">
                {MOCK_TRACKING.timeline.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          step.done
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {step.done ? (
                          <Icon size={14} />
                        ) : (
                          <Clock size={14} />
                        )}
                      </div>
                      <div className="flex-1 pb-1">
                        <p
                          className={`text-sm font-semibold ${
                            step.done ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {step.status}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{step.date}</p>
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
                <a href="mailto:support@lynsie-charm.com" className="text-purple-600 hover:underline">
                  Contact support
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Demo hint */}
        <p className="text-xs text-center text-gray-400 mt-6">
          💡 Preview: enter any order number + email to see mock tracking result
        </p>
      </main>
    </div>
  );
}
