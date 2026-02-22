'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, TrendingUp, Wallet, PauseCircle, ArrowDownToLine } from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, pct, today, daysAgo } from '@/lib/format';
import type { CampaignsResponse, Campaign, SellpagesListResponse, SellpageListItem } from '@/types/api';

const DATE_PRESETS = [
  { label: 'Today', from: today(), to: today() },
  { label: '7d', from: daysAgo(7), to: today() },
  { label: '30d', from: daysAgo(30), to: today() },
];

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<CampaignsResponse | null>(null);
  const [sellpages, setSellpages] = useState<SellpageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [activePreset, setActivePreset] = useState('30d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsRes, sellpagesRes] = await Promise.all([
        apiGet<CampaignsResponse>(`/ads-manager/campaigns?dateFrom=${dateFrom}&dateTo=${dateTo}`),
        apiGet<SellpagesListResponse>('/sellpages?page=1&limit=10'),
      ]);
      setCampaigns(campaignsRes);
      setSellpages(sellpagesRes.data ?? []);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load analytics');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const s = campaigns?.summary;

  // KPI values derived from ads-manager summary
  const totalRevenue = s ? s.roas * s.spend : 0; // purchaseValue = roas * spend
  const totalCost = s?.spend ?? 0;
  // youTake/hold/cashToBalance come from sellpage stats (all stubs = 0 for now)
  const totalYouTake = sellpages.reduce((acc, sp) => acc + sp.stats.youTake, 0);
  const totalHold = sellpages.reduce((acc, sp) => acc + sp.stats.hold, 0);
  const totalCashToBalance = sellpages.reduce((acc, sp) => acc + sp.stats.cashToBalance, 0);

  // Top campaigns by spend
  const topCampaigns = campaigns?.campaigns
    ? [...campaigns.campaigns].sort((a, b) => b.spend - a.spend).slice(0, 5)
    : [];

  const campaignCols: Column<Campaign>[] = [
    { key: 'name', label: 'Campaign', render: (r) => <span className="text-foreground font-medium truncate max-w-[200px] block">{r.name}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'spend', label: 'Spend', className: 'text-right', render: (r) => <span className="font-mono text-foreground text-xs">{moneyWhole(r.spend)}</span> },
    { key: 'roas', label: 'ROAS', className: 'text-right', render: (r) => <span className="font-mono text-foreground text-xs">{r.storeMetricsPending ? 'N/A' : r.roas.toFixed(2)}</span> },
    { key: 'purchases', label: 'Conv.', className: 'text-right', render: (r) => <span className="font-mono text-foreground text-xs">{r.storeMetricsPending ? 'N/A' : num(r.purchases)}</span> },
    { key: 'ctr', label: 'CTR', className: 'text-right', render: (r) => <span className="font-mono text-foreground text-xs">{r.storeMetricsPending ? 'N/A' : pct(r.ctr)}</span> },
  ];

  const sellpageCols: Column<SellpageListItem>[] = [
    { key: 'slug', label: 'Sellpage', render: (r) => <span className="text-foreground font-medium">{r.titleOverride ?? r.slug}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'revenue', label: 'Revenue', className: 'text-right', render: (r) => <span className="font-mono text-foreground text-xs">{r.stats.revenue === 0 ? '—' : moneyWhole(r.stats.revenue)}</span> },
    { key: 'youTake', label: 'YouTake', className: 'text-right', render: (r) => <span className="font-mono text-foreground text-xs">{r.stats.youTake === 0 ? '—' : moneyWhole(r.stats.youTake)}</span> },
  ];

  return (
    <PageShell
      title="Analytics"
      subtitle="Performance overview"
      icon={<BarChart3 size={22} />}
    >
      {/* Date presets */}
      <div className="flex items-center gap-2 mb-6">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => { setDateFrom(p.from); setDateTo(p.to); setActivePreset(p.label); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              activePreset === p.label
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setActivePreset(''); }}
          className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none ml-2"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setActivePreset(''); }}
          className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none"
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={fetchData} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Revenue"
          value={loading ? '' : moneyWhole(totalRevenue)}
          icon={<DollarSign size={16} />}
          loading={loading}
          sub="purchaseValue from ads"
        />
        <KpiCard
          label="Ad Spend"
          value={loading ? '' : moneyWhole(totalCost)}
          icon={<TrendingUp size={16} />}
          loading={loading}
        />
        <KpiCard
          label="YouTake"
          value={loading ? '' : totalYouTake === 0 ? '—' : moneyWhole(totalYouTake)}
          icon={<Wallet size={16} />}
          loading={loading}
          sub={totalYouTake === 0 ? 'Stub — not yet wired' : undefined}
        />
        <KpiCard
          label="Hold"
          value={loading ? '' : totalHold === 0 ? '—' : moneyWhole(totalHold)}
          icon={<PauseCircle size={16} />}
          loading={loading}
          sub={totalHold === 0 ? 'Stub — not yet wired' : undefined}
        />
        <KpiCard
          label="CashToBalance"
          value={loading ? '' : totalCashToBalance === 0 ? '—' : moneyWhole(totalCashToBalance)}
          icon={<ArrowDownToLine size={16} />}
          loading={loading}
          sub={totalCashToBalance === 0 ? 'Stub — not yet wired' : undefined}
        />
      </div>

      {/* Top campaigns by spend */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground mb-3">Top Campaigns by Spend</h2>
        <DataTable
          columns={campaignCols}
          data={topCampaigns}
          loading={loading}
          rowKey={(r) => r.id}
          emptyMessage="No campaigns in this period."
          skeletonRows={3}
        />
      </div>

      {/* Sellpages by revenue (stub data) */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-foreground mb-3">Sellpages</h2>
        <DataTable
          columns={sellpageCols}
          data={sellpages}
          loading={loading}
          rowKey={(r) => r.id}
          emptyMessage="No sellpages found."
          skeletonRows={3}
        />
        {!loading && sellpages.length > 0 && sellpages.every((sp) => sp.stats.revenue === 0) && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            Sellpage revenue stats are stubs (not yet implemented in backend).
          </p>
        )}
      </div>

      {/* Top creatives placeholder */}
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Top Creatives by Spend/ROAS
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Coming soon — endpoint not yet available
        </p>
      </div>
    </PageShell>
  );
}
