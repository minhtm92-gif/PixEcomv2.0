'use client';

import { type ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  sub?: string;
  loading?: boolean;
}

export function KpiCard({ label, value, icon, sub, loading }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 bg-muted rounded w-24 animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-foreground">{value}</p>
      )}
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
