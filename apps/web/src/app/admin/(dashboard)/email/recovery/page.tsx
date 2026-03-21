'use client';

import { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { useAdminApi } from '@/hooks/useAdminApi';
import { num, moneyWhole, pct } from '@/lib/format';

// ── Types ───────────────────────────────────────────────────────────────────

interface RecoveryStats {
  totalAbandoned: number;
  totalRecovered: number;
  recoveryRate: number;
  revenueRecovered: number;
}

interface AbandonedCartItem {
  name: string;
  quantity: number;
  price: number;
}

interface AbandonedCart {
  id: string;
  email: string | null;
  stage: 'cart' | 'checkout';
  items: AbandonedCartItem[];
  totalValue: number;
  recoveryEmailsSent: number;
  recoveryEmailsTotal: number;
  status: 'abandoned' | 'recovered' | 'expired';
  abandonedAt: string;
  recoveredAt: string | null;
}

interface AbandonedCartsResponse {
  data: AbandonedCart[];
  total: number;
  stats?: RecoveryStats;
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STAGE_FILTERS = ['all', 'cart', 'checkout'] as const;
const STATUS_FILTERS = ['all', 'abandoned', 'recovered', 'expired'] as const;

export default function EmailRecoveryPage() {
  const [stageFilter, setStageFilter] = useState<typeof STAGE_FILTERS[number]>('all');
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('all');

  // Build query params
  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (stageFilter !== 'all') params.set('stage', stageFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    return `/abandoned-carts?${params.toString()}`;
  }, [stageFilter, statusFilter]);

  const { data: cartsData, loading, error } = useAdminApi<AbandonedCartsResponse | AbandonedCart[]>(apiPath);
  const { data: recoveryStats } = useAdminApi<RecoveryStats>('/email-analytics/recovery');

  // Normalize response
  const carts: AbandonedCart[] = useMemo(() => {
    if (!cartsData) return [];
    if (Array.isArray(cartsData)) return cartsData;
    return cartsData.data ?? [];
  }, [cartsData]);

  // Use stats from recovery endpoint or from abandoned-carts response
  const stats = useMemo(() => {
    if (recoveryStats) return recoveryStats;
    if (cartsData && !Array.isArray(cartsData) && cartsData.stats) return cartsData.stats;
    return null;
  }, [recoveryStats, cartsData]);

  const columns: Column<AbandonedCart>[] = [
    {
      key: 'email',
      label: 'Email',
      render: (r) => (
        <span className={`text-sm ${r.email ? 'text-foreground' : 'text-muted-foreground italic'}`}>
          {r.email ?? 'No email captured'}
        </span>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (r) => (
        <span
          className={`inline-block px-2 py-0.5 rounded border text-xs font-medium uppercase ${
            r.stage === 'checkout'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {r.stage}
        </span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      hiddenOnMobile: true,
      render: (r) => {
        const names = r.items?.map((i) => i.name) ?? [];
        const display = names.length > 2
          ? `${names.slice(0, 2).join(', ')} +${names.length - 2}`
          : names.join(', ');
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block" title={names.join(', ')}>
            {display || '--'}
          </span>
        );
      },
    },
    {
      key: 'totalValue',
      label: 'Value',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">{moneyWhole(r.totalValue)}</span>
      ),
    },
    {
      key: 'recoveryEmails',
      label: 'Emails Sent',
      className: 'text-center',
      render: (r) => {
        const sent = r.recoveryEmailsSent ?? 0;
        const total = r.recoveryEmailsTotal ?? 3;
        return (
          <div className="flex items-center justify-center gap-1">
            <div className="flex gap-0.5">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < sent ? 'bg-amber-400' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-1">{sent}/{total}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const statusMap: Record<string, string> = {
          abandoned: 'PENDING',
          recovered: 'DELIVERED',
          expired: 'ARCHIVED',
        };
        return <StatusBadge status={statusMap[r.status] ?? r.status.toUpperCase()} />;
      },
    },
    {
      key: 'abandonedAt',
      label: 'Abandoned',
      className: 'text-right',
      render: (r) => (
        <span className="text-xs text-muted-foreground" title={new Date(r.abandonedAt).toLocaleString()}>
          {timeAgo(r.abandonedAt)}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      icon={<ShoppingCart size={20} className="text-amber-400" />}
      title="Cart Recovery"
      subtitle="Abandoned carts and recovery email performance"
      backHref="/admin/email"
      backLabel="Email Marketing"
    >
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Abandoned"
          value={num(stats?.totalAbandoned ?? 0)}
          icon={<ShoppingCart size={14} />}
        />
        <KpiCard
          label="Recovered"
          value={num(stats?.totalRecovered ?? 0)}
          icon={<CheckCircle size={14} className="text-green-400" />}
        />
        <KpiCard
          label="Recovery Rate"
          value={pct(stats?.recoveryRate ?? 0)}
          icon={<Mail size={14} />}
        />
        <KpiCard
          label="Revenue Recovered"
          value={moneyWhole(stats?.revenueRecovered ?? 0)}
          icon={<DollarSign size={14} className="text-green-400" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        {/* Stage Filter */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {STAGE_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                stageFilter === s
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All Stages' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-4">
          Could not load abandoned carts. The endpoint may not be available yet.
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={carts}
        loading={loading}
        emptyMessage={error ? 'No data available — the abandoned carts endpoint may not be built yet.' : 'No abandoned carts found.'}
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
