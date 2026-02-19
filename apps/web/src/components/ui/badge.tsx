import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center border border-transparent font-medium',
  {
    variants: {
      variant: {
        primary: 'bg-primary/15 text-primary border-primary/20',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-500/15 text-green-400 border-green-500/20',
        warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
        destructive: 'bg-red-500/15 text-red-400 border-red-500/20',
        outline: 'bg-transparent border-border text-secondary-foreground',
        info: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
      },
      size: {
        md: 'rounded-md px-2 h-6 min-w-6 gap-1.5 text-xs',
        sm: 'rounded-sm px-1.5 h-5 min-w-5 gap-1 text-2xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'sm',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
