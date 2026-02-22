'use client';

import { X, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { MockCartItem, STORE_CONFIG } from '@/mock/storefront';

interface CartPanelProps {
  open: boolean;
  onClose: () => void;
  items: MockCartItem[];
  onUpdate: (items: MockCartItem[]) => void;
  storeSlug: string;
}

export function CartPanel({ open, onClose, items, onUpdate, storeSlug }: CartPanelProps) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  function remove(id: string) {
    onUpdate(items.filter(i => i.id !== id));
  }

  function changeQty(id: string, qty: number) {
    if (qty < 1) return remove(id);
    onUpdate(items.map(i => (i.id === id ? { ...i, qty } : i)));
  }

  const firstSlug = items[0]?.slug ?? 'product';

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
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <ShoppingCart size={20} />
            Cart
            {items.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({items.length})</span>
            )}
          </span>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X size={20} />
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
              className="mt-2 px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-xl bg-gray-100 flex-shrink-0"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        'https://picsum.photos/seed/cart/200/200';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {item.variant && (
                      <p className="text-xs text-gray-500">{item.variant}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {/* Qty controls */}
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
                      <span className="text-sm font-bold text-gray-900">
                        ${(item.price * item.qty).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    aria-label="Remove item"
                    className="text-gray-300 hover:text-red-400 transition-colors self-start mt-1 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
              {/* Free shipping nudge */}
              {subtotal < STORE_CONFIG.shippingThreshold && (
                <div className="mb-3 text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                  🚚 Add{' '}
                  <span className="font-semibold">
                    ${(STORE_CONFIG.shippingThreshold - subtotal).toFixed(2)}
                  </span>{' '}
                  more for free shipping!
                </div>
              )}

              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="font-bold text-gray-900 text-lg">${subtotal.toFixed(2)}</span>
              </div>

              <Link
                href={`/${storeSlug}/${firstSlug}/checkout`}
                onClick={onClose}
                className="block w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-center font-semibold rounded-xl transition-colors"
              >
                Checkout — ${subtotal.toFixed(2)}
              </Link>

              <button
                onClick={onClose}
                className="w-full py-2 mt-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
