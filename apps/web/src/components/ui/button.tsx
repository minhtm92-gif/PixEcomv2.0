import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        mono: 'bg-zinc-200 text-zinc-900 hover:bg-zinc-200/90 shadow-sm',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
        outline: 'border border-input bg-background text-accent-foreground hover:bg-accent shadow-sm',
        ghost: 'text-accent-foreground hover:bg-accent hover:text-accent-foreground',
        dim: 'text-muted-foreground hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        lg: 'h-10 rounded-md px-4 gap-2 [&_svg]:size-4',
        md: 'h-8 rounded-md px-3 gap-1.5 text-2sm [&_svg]:size-4',
        sm: 'h-7 rounded-md px-2.5 gap-1 text-xs [&_svg]:size-3.5',
        icon: 'h-8 w-8 rounded-md [&_svg]:size-4 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
