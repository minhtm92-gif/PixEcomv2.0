'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  Plus,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { apiGet, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { fmtDate } from '@/lib/format';
import type {
  CampaignListItem,
  CampaignsListResponse,
  CampaignDetail,
  CreateCampaignDto,
  BudgetType,
  SellpagesListResponse,
  SellpageListItem,
  FbConnection,
  FbConnectionsResponse,
} from '@/types/api';
import { isDraftCampaign } from '@/types/api';

// ── Status helper ──
type DisplayStatus = 'draft' | 'active' | 'paused' | 'archived';

function getDisplayStatus(c: Pick<CampaignListItem, 'status' | 'externalCampaignId'>): DisplayStatus {
  if (c.status === 'ARCHIVED') return 'archived';
  if (c.status === 'ACTIVE') return 'active';
  if (isDraftCampaign(c)) return 'draft';
  return 'paused';
}

const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border border-border' },
  active: { label: 'Active', className: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  paused: { label: 'Paused', className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  archived: { label: 'Archived', className: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

function CampaignStatusBadge({ campaign }: { campaign: Pick<CampaignListItem, 'status' | 'externalCampaignId'> }) {
  const ds = getDisplayStatus(campaign);
  const cfg = STATUS_CONFIG[ds];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

// ── Wizard ────────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

interface WizardState {
  // Step 1
  sellpageId: string;
  // Step 2
  adAccountId: string;
  // Step 3
  name: string;
  budget: string;
  budgetType: BudgetType;
  startDate: string;
  endDate: string;
}

const INITIAL_WIZARD: WizardState = {
  sellpageId: '',
  adAccountId: '',
  name: '',
  budget: '',
  budgetType: 'DAILY',
  startDate: '',
  endDate: '',
};

function WizardStepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                  ? 'bg-primary/20 text-primary border border-primary'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {done ? <Check size={12} /> : num}
            </div>
            {i < TOTAL_STEPS - 1 && (
              <div className={`h-px w-8 ${num < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface WizardProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

function CampaignWizard({ onClose, onCreated }: WizardProps) {
  const addToast = useToastStore((s) => s.add);
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD);
  const [creating, setCreating] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Sellpages
  const [sellpages, setSellpages] = useState<SellpageListItem[]>([]);
  const [sellpagesLoading, setSellpagesLoading] = useState(false);

  // Ad accounts
  const [adAccounts, setAdAccounts] = useState<FbConnection[]>([]);
  const [adAccountsLoading, setAdAccountsLoading] = useState(false);

  useEffect(() => {
    setSellpagesLoading(true);
    apiGet<SellpagesListResponse>('/sellpages?limit=100')
      .then((res) => setSellpages(res.data ?? []))
      .catch((err) => toastApiError(err as ApiError))
      .finally(() => setSellpagesLoading(false));
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    setAdAccountsLoading(true);
    apiGet<FbConnectionsResponse>('/fb/connections?connectionType=AD_ACCOUNT')
      .then((res) => setAdAccounts(res.data ?? []))
      .catch((err) => toastApiError(err as ApiError))
      .finally(() => setAdAccountsLoading(false));
  }, [step]);

  function update(patch: Partial<WizardState>) {
    setState((s) => ({ ...s, ...patch }));
    setWizardError(null);
  }

  function canNext(): boolean {
    if (step === 1) return !!state.sellpageId;
    if (step === 2) return !!state.adAccountId;
    if (step === 3) return !!state.name.trim() && !!state.budget && Number(state.budget) > 0;
    return true;
  }

  async function handleSubmit() {
    setCreating(true);
    setWizardError(null);
    try {
      const body: CreateCampaignDto = {
        name: state.name.trim(),
        sellpageId: state.sellpageId,
        adAccountId: state.adAccountId,
        budget: Number(state.budget),
        budgetType: state.budgetType,
      };
      if (state.startDate) body.startDate = state.startDate;
      if (state.endDate) body.endDate = state.endDate;

      const created = await apiPost<CampaignDetail>('/campaigns', body);
      addToast('Campaign created', 'success');
      onCreated(created.id);
    } catch (err) {
      const e = err as ApiError;
      setWizardError(e.message ?? 'Failed to create campaign');
      toastApiError(e);
    } finally {
      setCreating(false);
    }
  }

  const selectedSellpage = sellpages.find((s) => s.id === state.sellpageId);
  const selectedAdAccount = adAccounts.find((a) => a.id === state.adAccountId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !creating && onClose()} />

      <div className="relative bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">New Campaign</h2>
          <button
            onClick={() => !creating && onClose()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <WizardStepIndicator step={step} />

          {/* Step 1: Select Sellpage */}
          {step === 1 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">Select Sellpage</h3>
              <p className="text-xs text-muted-foreground mb-4">Choose which sellpage to run ads for</p>
              {sellpagesLoading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <select
                  value={state.sellpageId}
                  onChange={(e) => update({ sellpageId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select a sellpage...</option>
                  {sellpages.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.urlPreview} — {sp.slug}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 2: Select Ad Account */}
          {step === 2 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">Select Ad Account</h3>
              <p className="text-xs text-muted-foreground mb-4">Choose which Facebook Ad Account to use</p>
              {adAccountsLoading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : adAccounts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No connected Ad Accounts.{' '}
                  <a href="/settings" className="text-primary underline">Go to Settings</a> to connect one.
                </div>
              ) : (
                <div className="space-y-2">
                  {adAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => update({ adAccountId: acc.id })}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-colors ${
                        state.adAccountId === acc.id
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-medium">{acc.name}</p>
                        <p className="text-[10px] text-muted-foreground">{acc.externalId}</p>
                      </div>
                      {state.adAccountId === acc.id && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Campaign Details */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground mb-1">Campaign Details</h3>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Campaign Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className={inputCls}
                  placeholder="My Campaign"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Budget <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={state.budget}
                    onChange={(e) => update({ budget: e.target.value })}
                    className={inputCls}
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">Budget Type</label>
                  <select
                    value={state.budgetType}
                    onChange={(e) => update({ budgetType: e.target.value as BudgetType })}
                    className={inputCls}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="LIFETIME">Lifetime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Start Date <span className="text-xs text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={state.startDate}
                    onChange={(e) => update({ startDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    End Date <span className="text-xs text-muted-foreground/60">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={state.endDate}
                    onChange={(e) => update({ endDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-4">Review & Create</h3>
              <div className="bg-muted/30 border border-border rounded-lg divide-y divide-border text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-foreground font-medium">{state.name}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Sellpage</span>
                  <span className="text-foreground text-right max-w-[200px] truncate">
                    {selectedSellpage?.urlPreview ?? state.sellpageId}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Ad Account</span>
                  <span className="text-foreground">{selectedAdAccount?.name ?? state.adAccountId}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="text-foreground">${state.budget} / {state.budgetType === 'DAILY' ? 'day' : 'lifetime'}</span>
                </div>
                {state.startDate && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="text-foreground">{state.startDate}</span>
                  </div>
                )}
                {state.endDate && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">End Date</span>
                    <span className="text-foreground">{state.endDate}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Campaign will be created as <strong className="text-foreground">Draft</strong>. You can launch it from the campaign detail page.
              </p>
              {wizardError && (
                <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {wizardError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            disabled={creating}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                       hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArrowLeft size={14} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <span className="text-xs text-muted-foreground">{step} / {TOTAL_STEPS}</span>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Next
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [data, setData] = useState<CampaignListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchCampaigns = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (cursor) params.set('cursor', cursor);
      if (search.trim()) params.set('q', search.trim());

      const res = await apiGet<CampaignsListResponse>(`/campaigns?${params.toString()}`);

      // client-side status filter
      let items = res.items ?? [];
      if (statusFilter !== 'ALL') {
        items = items.filter((c) => getDisplayStatus(c) === statusFilter);
      }

      setData(cursor ? (prev) => [...prev, ...items] : items);
      setNextCursor(res.nextCursor);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load campaigns');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  // Reset and refetch when filters change
  useEffect(() => {
    setData([]);
    setNextCursor(null);
    fetchCampaigns();
  }, [fetchCampaigns]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  function handleWizardCreated(id: string) {
    setWizardOpen(false);
    addToast('Redirecting to campaign...', 'info');
    router.push(`/campaigns/${id}`);
  }

  const columns: Column<CampaignListItem>[] = [
    {
      key: 'name',
      label: 'Campaign',
      render: (r) => (
        <div>
          <p className="text-foreground font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.sellpage?.urlPreview ?? r.sellpageId}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <CampaignStatusBadge campaign={r} />,
    },
    {
      key: 'budget',
      label: 'Budget',
      render: (r) => (
        <span className="text-sm text-foreground">
          {r.budgetPerDay != null ? `$${r.budgetPerDay}` : '—'}
          <span className="text-[10px] text-muted-foreground ml-1">
            /{r.budgetType === 'DAILY' ? 'day' : 'lifetime'}
          </span>
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: 'action',
      label: '',
      className: 'w-8',
      render: () => <ChevronRight size={14} className="text-muted-foreground" />,
    },
  ];

  const total = data?.length ?? 0;

  return (
    <>
      <PageShell
        title="Campaigns"
        subtitle={`${total} campaign${total !== 1 ? 's' : ''}`}
        icon={<Rocket size={22} />}
        actions={
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            New Campaign
          </button>
        }
      >
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search campaigns..."
                className="pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {error}
            <button onClick={() => fetchCampaigns()} className="ml-3 underline hover:text-red-300">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          rowKey={(r) => r.id}
          emptyMessage="No campaigns found."
          onRowClick={(r) => router.push(`/campaigns/${r.id}`)}
        />

        {/* Load more (keyset pagination) */}
        {nextCursor && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => fetchCampaigns(nextCursor)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:text-foreground disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronLeft size={14} className="rotate-180" />}
              Load more
            </button>
          </div>
        )}
      </PageShell>

      {wizardOpen && (
        <CampaignWizard
          onClose={() => setWizardOpen(false)}
          onCreated={handleWizardCreated}
        />
      )}
    </>
  );
}
