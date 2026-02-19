'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options?: SelectOption[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, value, onValueChange, onChange, placeholder, className, wrapperClassName, children, ...props }, ref) => {
    const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    return (
      <div className={cn('relative', wrapperClassName)}>
        <select
          ref={ref}
          value={value}
          onChange={handleChange}
          className={cn(
            'flex h-8 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-2sm text-foreground shadow-sm transition-colors',
            'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
            'disabled:cursor-not-allowed disabled:opacity-60',
            !value && 'text-muted-foreground/70',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
