'use client';

import { MockVariant } from '@/mock/storefront';

interface VariantSelectorProps {
  variants: MockVariant[];
  selected: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

export function VariantSelector({ variants, selected, onChange }: VariantSelectorProps) {
  return (
    <div className="space-y-5">
      {variants.map(v => {
        const activeValue = selected[v.name] ?? v.options[0]?.value;
        const activeLabel = v.options.find(o => o.value === activeValue)?.label ?? '';

        return (
          <div key={v.name}>
            <p className="text-sm font-semibold text-gray-900 mb-2">
              {v.name}:{' '}
              <span className="font-normal text-gray-500">{activeLabel}</span>
            </p>

            <div className="flex flex-wrap gap-2">
              {v.options.map(opt => {
                const isSelected = activeValue === opt.value;
                const isColor = !!opt.color;

                if (isColor) {
                  return (
                    <button
                      key={opt.value}
                      onClick={() => opt.available && onChange(v.name, opt.value)}
                      disabled={!opt.available}
                      title={opt.label}
                      aria-label={opt.label}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        isSelected
                          ? 'border-purple-500 scale-110 shadow-md ring-2 ring-purple-200'
                          : 'border-gray-300 hover:border-gray-500'
                      } ${!opt.available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ backgroundColor: opt.color }}
                    />
                  );
                }

                return (
                  <button
                    key={opt.value}
                    onClick={() => opt.available && onChange(v.name, opt.value)}
                    disabled={!opt.available}
                    className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-400 bg-white'
                    } ${
                      !opt.available
                        ? 'opacity-30 cursor-not-allowed line-through'
                        : 'cursor-pointer'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
