'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

interface StickyDesktopCTAProps {
  price: number;
  comparePrice?: number;
  onBuyNow: () => void;
  ctaRef: React.RefObject<HTMLDivElement | null>;
}

export function StickyDesktopCTA({ price, comparePrice, onBuyNow, ctaRef }: StickyDesktopCTAProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show the sticky bar when the main CTA is NOT visible (scrolled past)
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ctaRef]);

  const off = comparePrice && comparePrice > price
    ? Math.round((1 - price / comparePrice) * 100)
    : 0;

  return (
    <div
      className={`hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-gray-900">${price.toFixed(2)}</span>
          {comparePrice && comparePrice > price && (
            <span className="text-base text-gray-400 line-through">${comparePrice.toFixed(2)}</span>
          )}
          {off > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {off}% OFF
            </span>
          )}
        </div>
        <button
          onClick={onBuyNow}
          className="flex items-center gap-2 px-8 py-3 bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white font-semibold rounded-2xl transition-colors"
        >
          <Zap size={16} />
          Buy Now
        </button>
      </div>
    </div>
  );
}
