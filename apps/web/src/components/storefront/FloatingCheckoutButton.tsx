'use client';

import { ShoppingCart } from 'lucide-react';

interface FloatingCheckoutButtonProps {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function FloatingCheckoutButton({
  label = 'Add to Cart',
  onClick,
  disabled,
  className = '',
}: FloatingCheckoutButtonProps) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 md:hidden ${className}`}>
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl shadow-2xl shadow-purple-500/40 transition-all"
      >
        <ShoppingCart size={18} />
        {label}
      </button>
    </div>
  );
}
