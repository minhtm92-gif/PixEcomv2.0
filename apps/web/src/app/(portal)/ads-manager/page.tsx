'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Megaphone,
  ArrowLeft,
  Filter,
  RefreshCw,
  X,
  DollarSign,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { AdsMetricsTable, SummaryBar } from '@/components/AdsMetricsTable';
import { today, daysAgo } from '@/lib/format';
import type {
  Campaign,
  Adset,
  Ad,
  AdsMetrics,
  CampaignsResponse,
  AdsetsResponse,
  AdsResponse,
  BulkActionResult,
  SyncResult,
} from '@/types/api';

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT', 'COMPLETED'];
const DATE_PRESETS = [
  { label: 'Today', value: () => ({ from: today(), to: today() }) },
  { label: '7d', value: () => ({ from: daysAgo(7), to: today() }) },
  { label: '30d', value: () => ({ from: daysAgo(30), to: today() }) },
];

type Tier = 'campaigns' | 'adsets' | 'ads';

const SYNC_COOLDOWN_SECS = 60;

export default function AdsManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addToast = useToastStore((s) => s.add);

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

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk action dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'pause' | 'resume' | 'budget' | null>(null);
  const [bulkBudgetInput, setBulkBudgetInput] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Sync
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncCooldown, setSyncCooldown] = useState(0);

  // Sync cooldown countdown
  useEffect(() => {
    if (syncCooldown <= 0) return;
    const t = setInterval(() => {
      setSyncCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [syncCooldown]);

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
      router.push(
        `/ads-manager?campaignId=${c.id}&campaignName=${encodeURIComponent(c.name)}`,
      );
    } else if (tier === 'adsets') {
      const a = row as Adset;
      router.push(
        `/ads-manager?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaignName)}&adsetId=${a.id}&adsetName=${encodeURIComponent(a.name)}`,
      );
    }
  }

  function goBack() {
    if (tier === 'ads') {
      router.push(
        `/ads-manager?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaignName)}`,
      );
    } else if (tier === 'adsets') {
      router.push('/ads-manager');
    }
  }

  // ── Sync ──
  async function handleSync() {
    if (syncCooldown > 0 || syncLoading) return;
    setSyncLoading(true);
    try {
      const res = await apiPost<SyncResult>('/ads-manager/sync');
      const { synced } = res;
      addToast(
        `Synced: ${synced.campaigns} campaigns, ${synced.adsets} adsets, ${synced.ads} ads`,
        'success',
      );
      setSyncCooldown(SYNC_COOLDOWN_SECS);
      await fetchData();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSyncLoading(false);
    }
  }

  // ── Bulk actions ──
  function openBulkDialog(action: 'pause' | 'resume' | 'budget') {
    setBulkAction(action);
    setBulkBudgetInput('');
    setBulkDialogOpen(true);
  }

  async function handleBulkConfirm() {
    if (!bulkAction || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      let result: BulkActionResult;
      if (bulkAction === 'budget') {
        const budget = parseFloat(bulkBudgetInput);
        if (isNaN(budget) || budget <= 0) {
          addToast('Enter a valid budget amount', 'error');
          setBulkLoading(false);
          return;
        }
        result = await apiPatch<BulkActionResult>('/ads-manager/bulk-budget', {
          campaignIds: selectedIds,
          budget,
        });
      } else {
        result = await apiPatch<BulkActionResult>('/ads-manager/bulk-status', {
          entityType: tier,
          entityIds: selectedIds,
          action: bulkAction,
        });
      }
      const msg = `Updated ${result.updated}, Skipped ${result.skipped}, Failed ${result.failed.length}`;
      addToast(msg, result.failed.length > 0 ? 'error' : 'success');
      setBulkDialogOpen(false);
      setBulkAction(null);
      setSelectedIds([]);
      await fetchData();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setBulkLoading(false);
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
      actions={
        <button
          onClick={handleSync}
          disabled={syncLoading || syncCooldown > 0}
          title={syncCooldown > 0 ? `Next sync in ${syncCooldown}s` : 'Sync from Meta'}
          className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm
                     hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
          {syncCooldown > 0 ? `Sync (${syncCooldown}s)` : 'Sync'}
        </button>
      }
    >
      {/* Breadcrumb */}
      {tier !== 'campaigns' && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => router.push('/ads-manager')}
            className="text-primary hover:underline"
          >
            Campaigns
          </button>
          {campaignName && (
            <>
              <span className="text-muted-foreground">/</span>
              {tier === 'ads' ? (
                <button
                  onClick={() =>
                    router.push(
                      `/ads-manager?campaignId=${campaignId}&campaignName=${encodeURIComponent(campaignName)}`,
                    )
                  }
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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s}
            </option>
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
          onChange={(e) => {
            setDateFrom(e.target.value);
            setActivePreset('');
          }}
          className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setActivePreset('');
          }}
          className="px-2 py-1.5 bg-input border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        {/* Platform */}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Filter size={12} />
          <span>Meta only</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={fetchData} className="ml-3 underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <AdsMetricsTable
        data={rows}
        loading={loading}
        nameLabel={tierLabels[tier].slice(0, -1)}
        emptyMessage={`No ${tierLabels[tier].toLowerCase()} found for this period.`}
        onRowClick={tier !== 'ads' ? drillDown : undefined}
        tier={tier}
        onAction={fetchData}
        onSelectionChange={setSelectedIds}
      />

      {/* Summary */}
      <SummaryBar summary={summary} loading={loading} />

      {/* ── Bulk Action Floating Bar ── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3
                        bg-card border border-border rounded-2xl shadow-2xl text-sm">
          <span className="text-muted-foreground font-medium">
            {selectedIds.length} selected
          </span>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => openBulkDialog('pause')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg
                       hover:bg-amber-500/25 transition-colors text-xs font-medium"
          >
            Pause All
          </button>
          <button
            onClick={() => openBulkDialog('resume')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 rounded-lg
                       hover:bg-green-500/25 transition-colors text-xs font-medium"
          >
            Resume All
          </button>
          {tier === 'campaigns' && (
            <button
              onClick={() => openBulkDialog('budget')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary rounded-lg
                         hover:bg-primary/25 transition-colors text-xs font-medium"
            >
              <DollarSign size={12} />
              Budget
            </button>
          )}
          <button
            onClick={() => setSelectedIds([])}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Bulk Action Confirm Dialog ── */}
      {bulkDialogOpen && bulkAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !bulkLoading && setBulkDialogOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
              <h2 className="text-base font-semibold text-foreground">
                {bulkAction === 'pause'
                  ? 'Pause All Selected?'
                  : bulkAction === 'resume'
                    ? 'Resume All Selected?'
                    : 'Set Budget for All Selected'}
              </h2>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              This will apply to{' '}
              <span className="text-foreground font-medium">{selectedIds.length}</span>{' '}
              {tierLabels[tier].toLowerCase()}.
            </p>

            {bulkAction === 'budget' && (
              <div className="mb-4">
                <label className="block text-sm text-muted-foreground mb-1.5">
                  New daily budget (USD)
                </label>
                <input
                  type="number"
                  value={bulkBudgetInput}
                  onChange={(e) => setBulkBudgetInput(e.target.value)}
                  placeholder="e.g. 50"
                  min={1}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm
                             placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkDialogOpen(false)}
                disabled={bulkLoading}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:text-foreground
                           disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkConfirm}
                disabled={bulkLoading || (bulkAction === 'budget' && !bulkBudgetInput)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg
                           text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {bulkLoading && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
