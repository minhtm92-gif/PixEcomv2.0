'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Eye,
  ShoppingCart,
  CreditCard,
  CheckCircle,
  Activity,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
} from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { num, moneyWhole, pct } from '@/lib/format';
import type {
  LivePreviewResponse,
  LivePreviewCampaign,
  HourlyStatsResponse,
  HourlyStatsRow,
  SellpageListItem,
  SellpagesListResponse,
} from '@/types/api';

// ── CR color thresholds ──────────────────────────────────────────────────────
function getCrColor(value: number, type: 'cr1' | 'cr2' | 'cr'): string {
  const thresholds = {
    cr1: { red: 10, yellow: 20 },
    cr2: { red: 50, yellow: 70 },
    cr: { red: 5, yellow: 15 },
  };
  const t = thresholds[type];
  if (value < t.red) return 'text-red-500';
  if (value < t.yellow) return 'text-yellow-500';
  return 'text-green-500';
}

export default function LivePreviewPage() {
  const [data, setData] = useState<LivePreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellpageId, setSellpageId] = useState<string>('');
  const [sellpages, setSellpages] = useState<Array<{ id: string; name: string }>>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [hourlyStats, setHourlyStats] = useState<HourlyStatsRow[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(true);
  const [todaySpend, setTodaySpend] = useState(0);

  // Load sellpages for filter dropdown
  useEffect(() => {
    apiGet<SellpagesListResponse>('/sellpages?page=1&limit=100')
      .then((res) => {
        const items = (res.data ?? []).map((sp: SellpageListItem) => ({
          id: sp.id,
          name: sp.titleOverride || sp.slug,
        }));
        setSellpages(items);
      })
      .catch(() => {
        // Non-critical: filter won't have sellpage options
      });
  }, []);

  // Load hourly stats for today (refreshes with main data)
  const fetchHourlyStats = useCallback(async () => {
    setHourlyLoading(true);
    try {
      const result = await apiGet<HourlyStatsResponse>('/ads-manager/hourly-stats');
      setHourlyStats(result.hourly ?? []);
      setTodaySpend(result.todaySpend ?? 0);
    } catch {
      // Non-critical: hourly stats table won't populate
    } finally {
      setHourlyLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sellpageId) params.set('sellpageId', sellpageId);
      const result = await apiGet<LivePreviewResponse>(
        `/ads-manager/live-preview${params.toString() ? `?${params}` : ''}`,
      );
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to fetch live data');
      toastApiError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellpageId]);

  // Auto-refresh every 10s
  useEffect(() => {
    fetchData();
    fetchHourlyStats();
    const interval = setInterval(() => {
      fetchData(true);
      fetchHourlyStats();
    }, 10_000);
    return () => clearInterval(interval);
  }, [fetchData, fetchHourlyStats]);

  const t = data?.totals;

  // Campaign table columns
  const campaignCols: Column<LivePreviewCampaign>[] = [
    {
      key: 'campaignName',
      label: 'Campaign',
      render: (r) => (
        <span className="text-foreground font-medium truncate max-w-[200px] block">
          {r.campaignName}
        </span>
      ),
    },
    {
      key: 'contentViews',
      label: 'CV',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.contentViews)}</span>,
    },
    {
      key: 'addToCart',
      label: 'ATC',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.addToCart)}</span>,
    },
    {
      key: 'checkout',
      label: 'CO',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.checkout)}</span>,
    },
    {
      key: 'purchases',
      label: 'PO',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.purchases)}</span>,
    },
    {
      key: 'spend',
      label: 'Spend',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-foreground text-xs">{moneyWhole(r.spend)}</span>,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-foreground text-xs">{moneyWhole(r.revenue)}</span>,
    },
    {
      key: 'cr1',
      label: 'CR1',
      className: 'text-right',
      render: (r) => <span className={`font-mono text-xs font-semibold ${getCrColor(r.cr1, 'cr1')}`}>{pct(r.cr1)}</span>,
    },
    {
      key: 'cr2',
      label: 'CR2',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className={`font-mono text-xs font-semibold ${getCrColor(r.cr2, 'cr2')}`}>{pct(r.cr2)}</span>,
    },
    {
      key: 'cr',
      label: 'CR',
      className: 'text-right',
      render: (r) => <span className={`font-mono text-xs font-semibold ${getCrColor(r.cr, 'cr')}`}>{pct(r.cr)}</span>,
    },
  ];

  // Hourly stats table columns
  const hourlyCols: Column<HourlyStatsRow>[] = [
    {
      key: 'hour',
      label: 'Time',
      render: (r) => (
        <span className="text-foreground font-medium text-xs font-mono">
          {String(r.hour).padStart(2, '0')}:00
        </span>
      ),
    },
    {
      key: 'revenue',
      label: 'Revenue',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground text-xs">{moneyWhole(r.revenue)}</span>,
    },
    {
      key: 'contentViews',
      label: 'CV',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.contentViews)}</span>,
    },
    {
      key: 'addToCart',
      label: 'ATC',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.addToCart)}</span>,
    },
    {
      key: 'checkout',
      label: 'CO',
      className: 'text-right',
      hiddenOnMobile: true,
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.checkout)}</span>,
    },
    {
      key: 'purchases',
      label: 'PO',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground text-xs">{num(r.purchases)}</span>,
    },
    {
      key: 'cr',
      label: 'CR',
      className: 'text-right',
      render: (r) => <span className={`font-mono text-xs font-semibold ${getCrColor(r.cr, 'cr')}`}>{pct(r.cr)}</span>,
    },
  ];

  return (
    <PageShell
      title="Live Preview"
      subtitle="Today — live visitor activity"
      icon={<Activity size={22} />}
      actions={
        <div className="flex items-center gap-3">
          {/* Pulse dot + last updated */}
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              Updated {lastUpdated}
            </div>
          )}

          {/* Sellpage filter */}
          <select
            value={sellpageId}
            onChange={(e) => setSellpageId(e.target.value)}
            className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none"
          >
            <option value="">All Sellpages</option>
            {sellpages.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium
                       hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      }
    >
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={() => fetchData()} className="ml-3 underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Active Visitors Hero Card */}
      <div className="flex justify-center mb-6">
        <div className="bg-card border border-border rounded-xl px-8 py-5 text-center min-w-[200px]">
          {loading ? (
            <div className="h-12 bg-muted rounded w-20 mx-auto animate-pulse mb-2" />
          ) : (
            <p className="text-5xl font-bold text-foreground tabular-nums">
              {num(data?.activeVisitors ?? 0)}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2">
            <Users size={14} className="text-green-500" />
            <p className="text-sm text-muted-foreground">visitors right now</p>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Content Views"
          value={loading ? '' : num(t?.contentViews ?? 0)}
          icon={<Eye size={16} />}
          loading={loading}
          sub="Unique page views"
        />
        <KpiCard
          label="Add to Cart"
          value={loading ? '' : num(t?.addToCart ?? 0)}
          icon={<ShoppingCart size={16} />}
          loading={loading}
          sub="Cart additions"
        />
        <KpiCard
          label="Checkout"
          value={loading ? '' : num(t?.checkout ?? 0)}
          icon={<CreditCard size={16} />}
          loading={loading}
          sub="Checkout initiated"
        />
        <KpiCard
          label="Purchases"
          value={loading ? '' : num(t?.purchases ?? 0)}
          icon={<CheckCircle size={16} />}
          loading={loading}
          sub="Completed orders"
        />
      </div>

      {/* Spend + Revenue row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <KpiCard
          label="Ad Spend"
          value={loading ? '' : moneyWhole(t?.spend ?? 0)}
          icon={<TrendingUp size={16} />}
          loading={loading}
          sub="Today's total (daily)"
        />
        <KpiCard
          label="Revenue"
          value={loading ? '' : moneyWhole(t?.revenue ?? 0)}
          icon={<DollarSign size={16} />}
          loading={loading}
          sub="Today"
        />
      </div>

      {/* CR Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* CR1: Checkout / Content Views */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              CR1
            </span>
            <span className="text-[10px] text-muted-foreground">(CO / CV)</span>
          </div>
          {loading ? (
            <div className="h-7 bg-muted rounded w-24 animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${getCrColor(t?.cr1 ?? 0, 'cr1')}`}>
              {pct(t?.cr1 ?? 0)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Checkout / Content Views</p>
        </div>

        {/* CR2: Purchases / Checkout */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              CR2
            </span>
            <span className="text-[10px] text-muted-foreground">(PO / CO)</span>
          </div>
          {loading ? (
            <div className="h-7 bg-muted rounded w-24 animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${getCrColor(t?.cr2 ?? 0, 'cr2')}`}>
              {pct(t?.cr2 ?? 0)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Purchases / Checkout</p>
        </div>

        {/* CR: Purchases / Content Views */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              CR
            </span>
            <span className="text-[10px] text-muted-foreground">(PO / CV)</span>
          </div>
          {loading ? (
            <div className="h-7 bg-muted rounded w-24 animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${getCrColor(t?.cr ?? 0, 'cr')}`}>
              {pct(t?.cr ?? 0)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Purchases / Content Views</p>
        </div>
      </div>

      {/* Hourly Statistics Table */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Hourly Statistics
          <span className="text-muted-foreground font-normal">(Today)</span>
          {todaySpend > 0 && (
            <span className="text-muted-foreground font-normal ml-2">
              — Spend: {moneyWhole(todaySpend)}
            </span>
          )}
        </h2>
        <DataTable
          columns={hourlyCols}
          data={hourlyStats}
          loading={hourlyLoading}
          rowKey={(r) => String(r.hour)}
          emptyMessage="No activity today yet."
          skeletonRows={6}
        />
      </div>

      {/* Campaign Breakdown Table */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground mb-3">
          Campaign Breakdown
          {data?.byCampaign && (
            <span className="text-muted-foreground font-normal ml-2">
              ({data.byCampaign.length} campaign{data.byCampaign.length !== 1 ? 's' : ''})
            </span>
          )}
        </h2>
        <DataTable
          columns={campaignCols}
          data={data?.byCampaign ?? []}
          loading={loading}
          rowKey={(r) => r.campaignName}
          emptyMessage="No campaign activity today."
          skeletonRows={4}
        />
      </div>
    </PageShell>
  );
}
