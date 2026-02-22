'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { STORE_CONFIG } from '@/mock/storefront';

export function PromoBar() {
  const [visible, setVisible] = useState(true);
  const [secs, setSecs] = useState(STORE_CONFIG.promoEndHours * 3600);

  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!visible) return null;

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="bg-purple-700 text-white text-xs sm:text-sm py-2 px-10 flex items-center justify-center relative">
      <span className="text-center leading-snug">
        {STORE_CONFIG.promoMessage}
        {secs > 0 && (
          <span className="ml-2 font-mono font-bold bg-purple-900/40 px-2 py-0.5 rounded">
            {pad(h)}:{pad(m)}:{pad(s)}
          </span>
        )}
      </span>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
