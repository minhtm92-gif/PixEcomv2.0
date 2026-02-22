'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Megaphone, ArrowLeft, Filter } from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { AdsMetricsTable, SummaryBar } from '@/components/AdsMetricsTable';
import { today, daysAgo } from '@/lib/format';
import type {
  Campaign, Adset, Ad, AdsMetrics,
  CampaignsResponse, AdsetsResponse, AdsResponse,
} from '@/types/api';

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT', 'COMPLETED'];
const DATE_PRESETS = [
  { label: 'Today', value: () => ({ from: today(), to: today() }) },
  { label: '7d', value: () => ({ from: daysAgo(7), to: today() }) },
  { label: '30d', value: () => ({ from: daysAgo(30), to: today() }) },
];

type Tier = 'campaigns' | 'adsets' | 'ads';

export default function AdsManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine tier from query params
  const campaignId = searchParams.get('campaignId');
  const adsetId = searchParams.get('adsetId');
  const tier: Tier = adsetId ? 'ads' : campaignId ? 'adsets' : 'campaigns';

  // Breadcrumb names
  const campaignName = searchParams.get('campaignName') ?? campaignId ?? '';
  const adsetName = searchParams.get('adsetName') ?? adsetId ?? '';

  // Filters
  const [status, setStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [activePreset, setActivePreset] = useState('30d');

  // Data
  const [rows, setRows] = useState<(Campaign | Adset | Ad)[]>([]);
  const [summary, setSummary] = useState<AdsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status !== 'ALL') params.set('status', status);

    try {
      if (tier === 'campaigns') {
        const res = await apiGet<CampaignsResponse>(`/ads-manager/campaigns?${params.toString()}`);
        setRows(res.campaigns ?? []);
        setSummary(res.summary);
      } else if (tier === 'adsets') {
        params.set('campaignId', campaignId!);
        const res = await apiGet<AdsetsResponse>(`/ads-manager/adsets?${params.toString()}`);
        setRows(res.adsets ?? []);
        setSummary(res.summary);
      } else {
        params.set('adsetId', adsetId!);
        const res = await apiGet<AdsResponse>(`/ads-manager/ads?${params.toString()}`);
        setRows(res.ads ?? []);
        setSummary(res.summary);
      }
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load data');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [tier, campaignId, adsetId, dateFrom, dateTo, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handlePreset(label: string, preset: { from: string; to: string }) {
    setDateFrom(preset.from);
    setDateTo(preset.to);
    setActivePreset(label);
  }

  function drillDown(row: Campaign | Adset | Ad) {
    if (tier === 'campaigns') {
      const c = row as Campaign;
      router.push(`/ads-manager?campaignId=${c.id}&campaignName=${encodeURIComponent(c.name)}`);
    } else if (tier === 'adsets') {
      const a = row as Adset;
      router.push(
        `/ads-manager?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaignName)}&adsetId=${a.id}&adsetName=${encodeURIComponent(a.name)}`,
      );
    }
    // ads tier: no drill-down
  }

  function goBack() {
    if (tier === 'ads') {
      router.push(`/ads-manager?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaignName)}`);
    } else if (tier === 'adsets') {
      router.push('/ads-manager');
    }
  }

  const tierLabels: Record<Tier, string> = {
    campaigns: 'Campaigns',
    adsets: 'Ad Sets',
    ads: 'Ads',
  };

  return (
    <PageShell
      title="Ads Manager"
      subtitle={tierLabels[tier]}
      icon={<Megaphone size={22} />}
    >
      {/* Breadcrumb */}
      {tier !== 'campaigns' && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button onClick={goBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-muted-foreground">/</span>
          <button onClick={() => router.push('/ads-manager')} className="text-primary hover:underline">
            Campaigns
          </button>
          {campaignName && (
            <>
              <span className="text-muted-foreground">/</span>
              {tier === 'ads' ? (
                <button
                  onClick={() => router.push(`/ads-manager?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaignName)}`)}
                  className="text-primary hover:underline"
                >
                  {campaignName}
                </button>
              ) : (
                <span className="text-foreground">{campaignName}</span>
              )}
            </>
          )}
          {adsetName && tier === 'ads' && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground">{adsetName}</span>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
          ))}
        </select>

        {/* Date presets */}
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p.label, p.value())}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                activePreset === p.label
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom dates */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setActivePreset(''); }}
          className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setActivePreset(''); }}
          className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        {/* Platform (future) */}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Filter size={12} />
          <span>Meta only</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={fetchData} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Table */}
      <AdsMetricsTable
        data={rows}
        loading={loading}
        nameLabel={tierLabels[tier].slice(0, -1)}
        emptyMessage={`No ${tierLabels[tier].toLowerCase()} found for this period.`}
        onRowClick={tier !== 'ads' ? drillDown : undefined}
      />

      {/* Summary */}
      <SummaryBar summary={summary} loading={loading} />
    </PageShell>
  );
}
