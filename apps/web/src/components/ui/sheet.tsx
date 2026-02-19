'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  width?: string;
}

function Sheet({ open, onClose, children, className, width = 'max-w-[480px]' }: SheetProps) {
  // Close on Escape
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[4px] animate-in fade-in-0"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex flex-col w-3/4 bg-background border-l border-border shadow-lg',
          'animate-in slide-in-from-right duration-300',
          width,
          className,
        )}
      >
        {children}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-60 transition-opacity hover:opacity-100 cursor-pointer"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1 p-6 pb-0', className)} {...props} />;
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto p-6', className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-foreground', className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export { Sheet, SheetBody, SheetDescription, SheetHeader, SheetTitle };
