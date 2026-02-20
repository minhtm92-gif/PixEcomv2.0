'use client';

import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { num, pct, moneyWhole, metricOrNA } from '@/lib/format';
import type { AdsMetrics } from '@/types/api';

/**
 * Shared metrics table used by campaigns, adsets, and ads views.
 * Columns exactly match the spec:
 *  Name, Platform, Status, Budget/Day, Spent, Impressions, Clicks, CTR, CPC,
 *  Contentview, Cost/Contentview, Checkout, Cost/Checkout, CR1, CR2, CR, Conv., ROAS
 */

export type AdsRow = AdsMetrics & {
  id: string;
  name: string;
  platform: string;
  status: string;
  budgetPerDay: number | null;
  [key: string]: unknown; // allow extra fields from Campaign/Adset/Ad
};

interface AdsMetricsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  loading: boolean;
  emptyMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowClick?: (row: any) => void;
  nameLabel?: string;
}

export function AdsMetricsTable({
  data,
  loading,
  emptyMessage = 'No data found.',
  onRowClick,
  nameLabel = 'Name',
}: AdsMetricsTableProps) {
  const columns: Column<AdsRow>[] = [
    {
      key: 'name',
      label: nameLabel,
      render: (r) => <span className="text-foreground font-medium whitespace-nowrap max-w-[200px] truncate block">{r.name}</span>,
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (r) => <span className="text-xs text-muted-foreground uppercase">{r.platform}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'budget',
      label: 'Budget/Day',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-foreground text-xs">
          {r.budgetPerDay != null ? moneyWhole(r.budgetPerDay) : '—'}
        </span>
      ),
    },
    {
      key: 'spend',
      label: 'Spent',
      className: 'text-right',
      render: (r) => <MetricCell value={r.spend} pending={r.storeMetricsPending} fmt={moneyWhole} />,
    },
    {
      key: 'impressions',
      label: 'Impr.',
      className: 'text-right',
      render: (r) => <MetricCell value={r.impressions} pending={r.storeMetricsPending} fmt={num} />,
    },
    {
      key: 'clicks',
      label: 'Clicks',
      className: 'text-right',
      render: (r) => <MetricCell value={r.clicks} pending={r.storeMetricsPending} fmt={num} />,
    },
    {
      key: 'ctr',
      label: 'CTR',
      className: 'text-right',
      render: (r) => <MetricCell value={r.ctr} pending={r.storeMetricsPending} fmt={pct} />,
    },
    {
      key: 'cpc',
      label: 'CPC',
      className: 'text-right',
      render: (r) => <MetricCell value={r.cpc} pending={r.storeMetricsPending} fmt={moneyWhole} />,
    },
    {
      key: 'contentViews',
      label: 'CV',
      className: 'text-right',
      render: (r) => <MetricCell value={r.contentViews} pending={r.storeMetricsPending} fmt={num} />,
    },
    {
      key: 'costPerContentView',
      label: 'Cost/CV',
      className: 'text-right',
      render: (r) => <MetricCell value={r.costPerContentView} pending={r.storeMetricsPending} fmt={moneyWhole} />,
    },
    {
      key: 'checkout',
      label: 'Checkout',
      className: 'text-right',
      render: (r) => <MetricCell value={r.checkout} pending={r.storeMetricsPending} fmt={num} />,
    },
    {
      key: 'costPerCheckout',
      label: 'Cost/CO',
      className: 'text-right',
      render: (r) => <MetricCell value={r.costPerCheckout} pending={r.storeMetricsPending} fmt={moneyWhole} />,
    },
    {
      key: 'cr1',
      label: 'CR1',
      className: 'text-right',
      render: (r) => <MetricCell value={r.cr1} pending={r.storeMetricsPending} fmt={pct} />,
    },
    {
      key: 'cr2',
      label: 'CR2',
      className: 'text-right',
      render: (r) => <MetricCell value={r.cr2} pending={r.storeMetricsPending} fmt={pct} />,
    },
    {
      key: 'cr',
      label: 'CR',
      className: 'text-right',
      render: (r) => <MetricCell value={r.cr} pending={r.storeMetricsPending} fmt={pct} />,
    },
    {
      key: 'purchases',
      label: 'Conv.',
      className: 'text-right',
      render: (r) => <MetricCell value={r.purchases} pending={r.storeMetricsPending} fmt={num} />,
    },
    {
      key: 'roas',
      label: 'ROAS',
      className: 'text-right',
      render: (r) => <MetricCell value={r.roas} pending={r.storeMetricsPending} fmt={(v) => v.toFixed(2)} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowKey={(r) => r.id}
      skeletonRows={4}
    />
  );
}

/** Summary row rendered beneath table */
export function SummaryBar({ summary, loading }: { summary: AdsMetrics | null; loading: boolean }) {
  if (loading || !summary) return null;
  return (
    <div className="mt-2 bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs">
      <SumItem label="Spend" value={metricOrNA(summary.spend, summary.storeMetricsPending, moneyWhole)} />
      <SumItem label="Impr." value={metricOrNA(summary.impressions, summary.storeMetricsPending, num)} />
      <SumItem label="Clicks" value={metricOrNA(summary.clicks, summary.storeMetricsPending, num)} />
      <SumItem label="CTR" value={metricOrNA(summary.ctr, summary.storeMetricsPending, pct)} />
      <SumItem label="CV" value={metricOrNA(summary.contentViews, summary.storeMetricsPending, num)} />
      <SumItem label="Checkout" value={metricOrNA(summary.checkout, summary.storeMetricsPending, num)} />
      <SumItem label="Conv." value={metricOrNA(summary.purchases, summary.storeMetricsPending, num)} />
      <SumItem label="ROAS" value={metricOrNA(summary.roas, summary.storeMetricsPending, (v) => v.toFixed(2))} />
    </div>
  );
}

function SumItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground font-medium font-mono">{value}</span>
    </div>
  );
}

function MetricCell({
  value,
  pending,
  fmt,
}: {
  value: number;
  pending: boolean;
  fmt: (n: number) => string;
}) {
  const display = metricOrNA(value, pending, fmt);
  return (
    <span className={`font-mono text-xs ${pending ? 'text-muted-foreground italic' : 'text-foreground'}`}>
      {display}
    </span>
  );
}
