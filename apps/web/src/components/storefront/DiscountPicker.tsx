'use client';

import { Check } from 'lucide-react';
import { MockCheckoutDiscount } from '@/mock/storefront';

interface DiscountPickerProps {
  discounts: MockCheckoutDiscount[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function DiscountPicker({ discounts, selected, onSelect }: DiscountPickerProps) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900 mb-3">Available Promotions</p>
      <div className="space-y-2">
        {discounts.map(d => {
          const isSelected = selected === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : d.id)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 shadow-sm'
                  : 'border-gray-200 hover:border-purple-300 bg-white'
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  isSelected
                    ? 'bg-purple-600 border border-purple-600'
                    : 'border-2 border-gray-300'
                }`}
              >
                {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{d.label}</span>
                  <span
                    className={`text-sm font-bold flex-shrink-0 ${
                      isSelected ? 'text-purple-700' : 'text-purple-600'
                    }`}
                  >
                    {d.value}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
