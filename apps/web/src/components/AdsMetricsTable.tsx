'use client';

import { useState } from 'react';
import { Pause, Play, Loader2, Check, X } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { num, pct, moneyWhole, metricOrNA } from '@/lib/format';
import { apiPost, apiPatch, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import type { AdsMetrics } from '@/types/api';

/**
 * Shared metrics table used by campaigns, adsets, and ads views.
 * Columns exactly match the spec:
 *  Name, Platform, Status, Budget/Day, Spent, Impressions, Clicks, CTR, CPC,
 *  Contentview, Cost/Contentview, Checkout, Cost/Checkout, CR1, CR2, CR, Conv., ROAS
 *
 * Optional extras when `tier` is provided:
 *  - Checkbox column (multi-select)
 *  - Actions column (Pause / Play)
 *  - Inline budget edit for campaigns tier
 */

export type AdsRow = AdsMetrics & {
  id: string;
  name: string;
  platform: string;
  status: string;
  budgetPerDay: number | null;
  [key: string]: unknown;
};

type Tier = 'campaigns' | 'adsets' | 'ads';

interface AdsMetricsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  loading: boolean;
  emptyMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowClick?: (row: any) => void;
  nameLabel?: string;
  /** When set, enables checkboxes, action buttons, and inline budget edit */
  tier?: Tier;
  /** Called after a pause/resume or budget action succeeds — triggers parent refetch */
  onAction?: () => void;
  /** Called whenever the selection changes */
  onSelectionChange?: (ids: string[]) => void;
}

export function AdsMetricsTable({
  data,
  loading,
  emptyMessage = 'No data found.',
  onRowClick,
  nameLabel = 'Name',
  tier,
  onAction,
  onSelectionChange,
}: AdsMetricsTableProps) {
  const addToast = useToastStore((s) => s.add);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState('');

  const allIds: string[] = data.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  function setSelection(newIds: string[]) {
    setSelectedIds(newIds);
    onSelectionChange?.(newIds);
  }

  function toggleSelectAll() {
    setSelection(allSelected ? [] : [...allIds]);
  }

  function toggleSelect(id: string) {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setSelection(newIds);
  }

  async function handleAction(row: AdsRow, action: 'pause' | 'resume') {
    setActionLoadingId(row.id);
    try {
      const path = tier === 'adsets' ? 'adsets' : tier === 'ads' ? 'ads' : 'campaigns';
      await apiPost(`/ads-manager/${path}/${row.id}/${action}`);
      addToast(`${action === 'pause' ? 'Paused' : 'Resumed'} "${row.name}"`, 'success');
      onAction?.();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleBudgetSave(row: AdsRow) {
    const budget = parseFloat(budgetInput);
    if (isNaN(budget) || budget <= 0) {
      setEditingBudgetId(null);
      return;
    }
    setActionLoadingId(row.id);
    try {
      await apiPatch(`/ads-manager/campaigns/${row.id}/budget`, { budget });
      addToast(`Budget updated for "${row.name}"`, 'success');
      setEditingBudgetId(null);
      onAction?.();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setActionLoadingId(null);
    }
  }

  // ── Checkbox column (only when tier is set) ──
  const checkboxCol: Column<AdsRow> = {
    key: 'checkbox',
    label: (
      <input
        type="checkbox"
        checked={allSelected}
        onChange={toggleSelectAll}
        className="w-3.5 h-3.5 accent-primary cursor-pointer"
      />
    ),
    className: 'w-8 text-center',
    render: (r) => (
      <div onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.includes(r.id)}
          onChange={() => toggleSelect(r.id)}
          className="w-3.5 h-3.5 accent-primary cursor-pointer"
        />
      </div>
    ),
  };

  // ── Main metric columns ──
  const metricColumns: Column<AdsRow>[] = [
    {
      key: 'name',
      label: nameLabel,
      render: (r) => (
        <span className="text-foreground font-medium whitespace-nowrap max-w-[200px] truncate block">
          {r.name}
        </span>
      ),
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (r) => (
        <span className="text-xs text-muted-foreground uppercase">{r.platform}</span>
      ),
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
      render: (r) => {
        // Inline budget edit — campaigns tier only
        if (tier === 'campaigns' && editingBudgetId === r.id) {
          return (
            <div
              className="flex items-center gap-1 justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBudgetSave(r);
                  if (e.key === 'Escape') setEditingBudgetId(null);
                }}
                className="w-20 px-1.5 py-0.5 bg-input border border-primary/60 rounded text-xs text-foreground focus:outline-none"
                min={1}
                step={1}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button
                onClick={() => handleBudgetSave(r)}
                title="Save"
                className="text-green-500 hover:text-green-400 transition-colors"
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setEditingBudgetId(null)}
                title="Cancel"
                className="text-red-500 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          );
        }

        return (
          <div
            className={`flex items-center justify-end gap-1 group ${
              tier === 'campaigns' ? 'cursor-pointer' : ''
            }`}
            onClick={
              tier === 'campaigns'
                ? (e) => {
                    e.stopPropagation();
                    setBudgetInput(String(r.budgetPerDay ?? ''));
                    setEditingBudgetId(r.id);
                  }
                : undefined
            }
            title={tier === 'campaigns' ? 'Click to edit budget' : undefined}
          >
            <span className="font-mono text-foreground text-xs">
              {r.budgetPerDay != null ? moneyWhole(r.budgetPerDay) : '—'}
            </span>
            {tier === 'campaigns' && r.budgetPerDay != null && (
              <span className="opacity-0 group-hover:opacity-60 text-muted-foreground text-[10px]">
                ✎
              </span>
            )}
          </div>
        );
      },
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
      render: (r) => (
        <MetricCell value={r.contentViews} pending={r.storeMetricsPending} fmt={num} />
      ),
    },
    {
      key: 'costPerContentView',
      label: 'Cost/CV',
      className: 'text-right',
      render: (r) => (
        <MetricCell value={r.costPerContentView} pending={r.storeMetricsPending} fmt={moneyWhole} />
      ),
    },
    {
      key: 'checkout',
      label: 'Checkout',
      className: 'text-right',
      render: (r) => (
        <MetricCell value={r.checkout} pending={r.storeMetricsPending} fmt={num} />
      ),
    },
    {
      key: 'costPerCheckout',
      label: 'Cost/CO',
      className: 'text-right',
      render: (r) => (
        <MetricCell value={r.costPerCheckout} pending={r.storeMetricsPending} fmt={moneyWhole} />
      ),
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
      render: (r) => (
        <MetricCell value={r.purchases} pending={r.storeMetricsPending} fmt={num} />
      ),
    },
    {
      key: 'roas',
      label: 'ROAS',
      className: 'text-right',
      render: (r) => (
        <MetricCell value={r.roas} pending={r.storeMetricsPending} fmt={(v) => v.toFixed(2)} />
      ),
    },
  ];

  // ── Actions column (only when tier is set) ──
  const actionCol: Column<AdsRow> = {
    key: 'actions',
    label: '',
    className: 'w-16 text-center',
    render: (r) => {
      if (actionLoadingId === r.id) {
        return <Loader2 size={14} className="animate-spin text-muted-foreground mx-auto" />;
      }
      if (r.status === 'ACTIVE') {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(r, 'pause');
            }}
            title="Pause"
            className="p-1.5 rounded hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Pause size={13} />
          </button>
        );
      }
      if (r.status === 'PAUSED') {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(r, 'resume');
            }}
            title="Resume"
            className="p-1.5 rounded hover:bg-green-500/15 text-green-400 hover:text-green-300 transition-colors"
          >
            <Play size={13} />
          </button>
        );
      }
      return <span className="text-muted-foreground/30 text-xs">—</span>;
    },
  };

  const allColumns = tier
    ? [checkboxCol, ...metricColumns, actionCol]
    : metricColumns;

  return (
    <DataTable
      columns={allColumns}
      data={data}
      loading={loading}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      rowKey={(r) => r.id}
      skeletonRows={4}
    />
  );
}

// ── Summary bar ──
export function SummaryBar({
  summary,
  loading,
}: {
  summary: AdsMetrics | null;
  loading: boolean;
}) {
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
      <SumItem
        label="ROAS"
        value={metricOrNA(summary.roas, summary.storeMetricsPending, (v) => v.toFixed(2))}
      />
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
    <span
      className={`font-mono text-xs ${pending ? 'text-muted-foreground italic' : 'text-foreground'}`}
    >
      {display}
    </span>
  );
}
