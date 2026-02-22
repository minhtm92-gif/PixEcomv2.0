'use client';

interface QuantitySelectorProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export function QuantitySelector({ value, min = 1, max = 10, onChange }: QuantitySelectorProps) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden w-fit">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xl font-light select-none"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-12 text-center text-gray-900 font-semibold text-sm select-none">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xl font-light select-none"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
