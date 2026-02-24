'use client';

import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { num, fmtDate } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_DISCOUNTS, type MockDiscount } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response type ───────────────────────────────────────────────────────

interface DiscountApi {
  id: string;
  code: string;
  type: string;
  value: number | string;
  usageLimit: number | null;
  uses: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  sellpage: { id: string; slug: string; titleOverride: string | null } | null;
}

// Unified row type
interface DiscountRow {
  id: string;
  code: string;
  sellpageName: string | null;
  type: string;
  value: number;
  uses: number;
  limit: number | null;
  status: string;
  expiresAt: string | null;
}

export default function SettingsDiscountsPage() {
  const { data: apiDiscounts, loading, error } = useAdminApi<DiscountApi[]>(
    IS_PREVIEW ? null : '/admin/discounts',
  );

  const discounts: DiscountRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return MOCK_DISCOUNTS.map((d) => ({
        id: d.id,
        code: d.code,
        sellpageName: d.sellpageName,
        type: d.type,
        value: d.value,
        uses: d.uses,
        limit: d.limit,
        status: d.status,
        expiresAt: d.expiresAt,
      }));
    }
    if (!apiDiscounts) return [];
    return apiDiscounts.map((d) => ({
      id: d.id,
      code: d.code,
      sellpageName: d.sellpage?.titleOverride ?? d.sellpage?.slug ?? null,
      type: d.type,
      value: Number(d.value),
      uses: d.uses ?? 0,
      limit: d.usageLimit,
      status: d.status,
      expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString().slice(0, 10) : null,
    }));
  }, [apiDiscounts]);

  const activeCount = discounts.filter((d) => d.status === 'ACTIVE').length;
  const totalUses = discounts.reduce((a, d) => a + d.uses, 0);
  const expiredCount = discounts.filter((d) => d.status === 'EXPIRED').length;

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading discounts...</p>
        </div>
      </div>
    );
  }

  const columns: Column<DiscountRow>[] = [
    {
      key: 'code',
      label: 'Code',
      render: (r) => <span className="font-mono text-sm font-bold text-amber-400">{r.code}</span>,
    },
    {
      key: 'sellpageName',
      label: 'Sellpage',
      render: (r) =>
        r.sellpageName ? (
          <span className="text-sm text-foreground">{r.sellpageName}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">Platform-wide</span>
        ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.type === 'PERCENT' ? `${r.value}%` : `$${r.value} off`}
        </span>
      ),
    },
    {
      key: 'uses',
      label: 'Uses',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">
          {num(r.uses)}
          {r.limit != null ? ` / ${num(r.limit)}` : ' / \u221E'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      className: 'text-right',
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.expiresAt ?? '\u2014'}</span>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Tag size={20} className="text-amber-400" />}
      title="Discounts & Coupons"
      subtitle="Manage platform-wide discount codes and rules"
      backHref="/admin/settings"
      backLabel="Settings"
      actions={
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors opacity-60 cursor-default">
          + New Discount
        </button>
      }
    >
      {!IS_PREVIEW && error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Codes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">{num(totalUses)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Uses</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">{expiredCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Expired</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={discounts}
        loading={false}
        emptyMessage="No discount codes found."
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
