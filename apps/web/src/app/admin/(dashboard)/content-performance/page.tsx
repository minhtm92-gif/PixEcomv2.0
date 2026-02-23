'use client';

import { TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, pct } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  CONTENT_PERFORMANCE_SELLPAGES,
  CONTENT_PERFORMANCE_CREATIVES,
  type MockContentPerformanceSellpage,
  type MockContentPerformanceCreative,
} from '@/mock/admin';

const totalSellpages = CONTENT_PERFORMANCE_SELLPAGES.length;
const publishedSellpages = CONTENT_PERFORMANCE_SELLPAGES.filter(
  (sp) => sp.status === 'PUBLISHED',
).length;
const totalCreatives = CONTENT_PERFORMANCE_CREATIVES.length;
const activeCreatives = CONTENT_PERFORMANCE_CREATIVES.filter(
  (c) => c.status === 'READY',
).length;

const sellpageColumns: Column<MockContentPerformanceSellpage>[] = [
  {
    key: 'name',
    label: 'Name',
    render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
  },
  {
    key: 'slug',
    label: 'Slug',
    render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.slug}</span>,
  },
  {
    key: 'product',
    label: 'Product',
    render: (r) => <span className="text-sm text-foreground">{r.product}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: 'views',
    label: 'Views',
    className: 'text-right',
    render: (r) => <span className="font-mono text-sm">{num(r.views)}</span>,
  },
  {
    key: 'orders',
    label: 'Orders',
    className: 'text-right',
    render: (r) => <span className="font-mono text-sm">{num(r.orders)}</span>,
  },
  {
    key: 'cr',
    label: 'CR%',
    className: 'text-right',
    render: (r) => <span className="font-mono text-sm">{pct(r.cr)}</span>,
  },
  {
    key: 'revenue',
    label: 'Revenue',
    className: 'text-right',
    render: (r) => (
      <span className={cn('font-mono text-sm', r.revenue > 0 ? 'text-green-400' : 'text-foreground')}>
        {moneyWhole(r.revenue)}
      </span>
    ),
  },
];

const creativeColumns: Column<MockContentPerformanceCreative>[] = [
  {
    key: 'name',
    label: 'Name',
    render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
  },
  {
    key: 'type',
    label: 'Type',
    render: (r) => (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
        {r.type.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    key: 'product',
    label: 'Product',
    render: (r) => <span className="text-sm text-foreground">{r.product}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: 'spend',
    label: 'Spend',
    className: 'text-right',
    render: (r) => <span className="font-mono text-sm">{moneyWhole(r.spend)}</span>,
  },
  {
    key: 'clicks',
    label: 'Clicks',
    className: 'text-right',
    render: (r) => <span className="font-mono text-sm">{num(r.clicks)}</span>,
  },
  {
    key: 'ctr',
    label: 'CTR%',
    className: 'text-right',
    render: (r) => <span className="font-mono text-sm">{pct(r.ctr)}</span>,
  },
  {
    key: 'roas',
    label: 'ROAS',
    className: 'text-right',
    render: (r) => (
      <span
        className={cn(
          'font-mono text-sm font-bold',
          r.roas >= 3
            ? 'text-green-400'
            : r.roas >= 2
              ? 'text-amber-400'
              : 'text-red-400',
        )}
      >
        {r.roas.toFixed(2)}
      </span>
    ),
  },
];

export default function ContentPerformancePage() {
  return (
    <PageShell
      icon={<TrendingUp size={20} className="text-amber-400" />}
      title="Content Performance"
      subtitle="Performance metrics for content you created"
    >
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Sellpages" value={num(totalSellpages)} />
        <KpiCard label="Published" value={num(publishedSellpages)} />
        <KpiCard label="Total Creatives" value={num(totalCreatives)} />
        <KpiCard label="Active Creatives" value={num(activeCreatives)} />
      </div>

      {/* Section 1: Sellpage Performance */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-foreground mb-4">Sellpage Performance</h3>
        <DataTable
          columns={sellpageColumns}
          data={CONTENT_PERFORMANCE_SELLPAGES}
          loading={false}
          emptyMessage="No sellpage data."
          rowKey={(r) => r.id}
        />
      </div>

      {/* Section 2: Creative Performance */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Creative Performance</h3>
        <DataTable
          columns={creativeColumns}
          data={CONTENT_PERFORMANCE_CREATIVES}
          loading={false}
          emptyMessage="No creative data."
          rowKey={(r) => r.id}
        />
      </div>
    </PageShell>
  );
}
