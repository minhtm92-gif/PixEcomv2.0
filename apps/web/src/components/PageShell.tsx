'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}

export function PageShell({ title, subtitle, icon, actions, backHref, backLabel, children }: PageShellProps) {
  return (
    <div className="p-4 md:p-6">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            {icon}
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 w-full sm:w-auto">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
