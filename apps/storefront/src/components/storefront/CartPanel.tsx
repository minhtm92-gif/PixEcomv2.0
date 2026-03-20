'use client';

import { X, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { MockCartItem, MockBoostModule } from '@/mock/storefront';
import { storeHref } from '@/lib/storefrontLinks';

interface CartPanelProps {
  open: boolean;
  onClose: () => void;
  items: MockCartItem[];
  onUpdate: (items: MockCartItem[]) => void;
  storeSlug: string;
  /** Boost modules from the sellpage — used for upsell banner */
  boostModules?: MockBoostModule[];
}

export function CartPanel({ open, onClose, items, onUpdate, storeSlug, boostModules }: CartPanelProps) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const compareSubtotal = items.reduce(
    (sum, i) => sum + (i.comparePrice ?? i.price) * i.qty,
    0,
  );
  const totalSaved = compareSubtotal - subtotal;

  function remove(id: string) {
    onUpdate(items.filter(i => i.id !== id));
  }

  function changeQty(id: string, qty: number) {
    if (qty < 1) return remove(id);
    onUpdate(items.map(i => (i.id === id ? { ...i, qty } : i)));
  }

  // Build checkout URL — store full cart in sessionStorage for multi-item support
  function getCheckoutUrl() {
    const item = items[0];
    if (!item) return storeHref(storeSlug, '/checkout');

    // Save full cart items to sessionStorage so checkout can read all of them
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pixecom_cart', JSON.stringify(items));
    }

    const params = new URLSearchParams();
    params.set('cart', '1'); // flag: read cart from sessionStorage
    if (item.upsellPct) params.set('upsellPct', String(item.upsellPct));

    return storeHref(storeSlug, `/${item.slug}/checkout?${params.toString()}`);
  }

  // Check for upsell next-item module
  const upsellModule = boostModules?.find(
    m => m.type === 'UPSELL_NEXT_ITEM' && m.enabled !== false,
  );
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  // Find next tier discount that would apply if user adds more items
  const nextTierPct = (() => {
    if (!upsellModule?.discountTiers?.length) return null;
    const sorted = [...upsellModule.discountTiers].sort((a, b) => a.quantity - b.quantity);
    // Find a tier the user hasn't reached yet
    const nextTier = sorted.find(t => t.quantity > totalQty);
    if (nextTier) return nextTier.discount;
    // If already at highest tier, show that tier
    const currentTier = [...sorted].reverse().find(t => totalQty >= t.quantity);
    return currentTier?.discount ?? null;
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 sm:w-96 bg-white z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900">Your shopping cart</span>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 p-8">
            <ShoppingCart size={48} className="opacity-30" />
            <div className="text-center">
              <p className="font-medium text-gray-600">Your cart is empty</p>
              <p className="text-sm mt-1">Add items to get started</p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-[var(--sp-primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--sp-primary-hover)] transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.map(item => {
                const itemTotal = item.price * item.qty;
                const itemCompareTotal = (item.comparePrice ?? item.price) * item.qty;
                const itemSaved = itemCompareTotal - itemTotal;

                return (
                  <div key={item.id} className="pb-4 border-b border-gray-50 last:border-0">
                    <div className="flex gap-3">
                      {/* Product image */}
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-lg bg-gray-100"
                          onError={e => {
                            (e.target as HTMLImageElement).src =
                              'https://picsum.photos/seed/cart/200/200';
                          }}
                        />
                        {item.variant && (
                          <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 py-0.5 rounded">
                            {item.variant.split(/[,/]/).map(s => s.trim().split(':').pop()?.trim()).filter(Boolean).join(' ')}
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{item.name}</p>
                          <button
                            onClick={() => remove(item.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0 font-medium"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Variant labels */}
                        {item.variant && (
                          <div className="flex flex-wrap gap-x-3 mt-0.5">
                            {item.variant.split(/\s{2,}/).map((seg, i) => (
                              <span key={i} className="text-xs text-gray-500">
                                <span className="font-medium">{seg.split(':')[0]}:</span> {seg.split(':')[1]?.trim()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Qty controls + price */}
                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => changeQty(item.id, item.qty - 1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm transition-colors"
                            >
                              −
                            </button>
                            <span className="text-sm font-semibold w-7 text-center text-gray-900">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => changeQty(item.id, item.qty + 1)}
                              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              {item.comparePrice && item.comparePrice > item.price && (
                                <span className="text-xs text-gray-400 line-through">${(item.comparePrice * item.qty).toFixed(2)}</span>
                              )}
                              <span className="text-sm font-bold text-gray-900">${itemTotal.toFixed(2)}</span>
                            </div>
                            {itemSaved > 0.01 && (
                              <p className="text-[11px] text-red-500 font-medium mt-0.5">
                                You saved ${itemSaved.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Upsell banner */}
              {nextTierPct && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-emerald-700">
                    <span className="text-emerald-600 font-bold">EXTRA {nextTierPct}% OFF</span>{' '}
                    for next item
                  </p>
                  <button
                    onClick={onClose}
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Select now
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-white">
              {/* Subtotal with compare */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-600">Subtotal</span>
                <div className="flex items-center gap-2">
                  {totalSaved > 0.01 && (
                    <span className="text-sm text-gray-400 line-through">${compareSubtotal.toFixed(2)}</span>
                  )}
                  <span className="font-bold text-gray-900 text-lg">${subtotal.toFixed(2)}</span>
                </div>
              </div>

              <Link
                href={getCheckoutUrl()}
                onClick={onClose}
                className="block w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white text-center font-bold text-sm rounded-xl transition-colors uppercase tracking-wide"
              >
                Proceed to Secure Checkout
              </Link>

              {/* Quick PayPal divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or quick checkout with</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* PayPal button placeholder */}
              <Link
                href={getCheckoutUrl()}
                onClick={onClose}
                className="block w-full py-3 bg-[#FFC439] hover:bg-[#f0b830] text-center rounded-xl transition-colors"
              >
                <span className="text-[#003087] font-bold text-base">Pay</span>
                <span className="text-[#009CDE] font-bold text-base">Pal</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
