'use client';

import { Tag } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { num } from '@/lib/format';
import { MOCK_DISCOUNTS, type MockDiscount } from '@/mock/admin';

export default function SettingsDiscountsPage() {
  const columns: Column<MockDiscount>[] = [
    {
      key: 'code',
      label: 'Code',
      render: (r) => <span className="font-mono text-sm font-bold text-amber-400">{r.code}</span>,
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
          {r.limit != null ? ` / ${num(r.limit)}` : ' / ∞'}
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
        <span className="text-xs text-muted-foreground">{r.expiresAt ?? '—'}</span>
      ),
    },
  ];

  return (
    <PageShell
      icon={<Tag size={20} className="text-amber-400" />}
      title="Discounts & Coupons"
      subtitle="Manage platform-wide discount codes and rules"
      actions={
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors opacity-60 cursor-default">
          + New Discount (Preview)
        </button>
      }
    >
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">
            {MOCK_DISCOUNTS.filter((d) => d.status === 'ACTIVE').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Active Codes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">
            {num(MOCK_DISCOUNTS.reduce((a, d) => a + d.uses, 0))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Total Uses</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">
            {MOCK_DISCOUNTS.filter((d) => d.status === 'EXPIRED').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Expired</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={MOCK_DISCOUNTS}
        loading={false}
        emptyMessage="No discount codes found."
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
