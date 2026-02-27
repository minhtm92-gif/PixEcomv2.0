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
  Zap,
} from 'lucide-react';
import { apiGet, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { CreativeSelector } from '@/components/CreativeSelector';
import { STRATEGY_PRESETS, type StrategyPreset } from '@/lib/strategyPresets';
import { fmtDate } from '@/lib/format';
import type {
  CampaignListItem,
  CampaignsListResponse,
  BudgetType,
  SellpagesListResponse,
  SellpageListItem,
  FbConnection,
  AdCreativeConfig,
  AdFormat,
  CreateCampaignBatchDto,
  BatchCreateResponse,
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
const TOTAL_STEPS = 5;

const STEP_LABELS = ['Sellpage', 'Account & Strategy', 'Campaign Config', 'Creatives', 'Review'];

interface WizardState {
  // Step 1
  sellpageId: string;
  // Step 2
  adAccountId: string;
  pageId: string;
  pixelId: string;
  strategyKey: string;
  // Step 3
  nameTemplate: string;
  campaignCount: number;
  budget: string;
  budgetType: BudgetType;
  initialStatus: 'ACTIVE' | 'PAUSED';
  // Step 4
  adCreatives: AdCreativeConfig[];
}

const DEFAULT_CREATIVE: AdCreativeConfig = { adFormat: 'VIDEO_AD' };

const INITIAL_WIZARD: WizardState = {
  sellpageId: '',
  adAccountId: '',
  pageId: '',
  pixelId: '',
  strategyKey: 'CBO_1_5_3',
  nameTemplate: '',
  campaignCount: 1,
  budget: '',
  budgetType: 'DAILY',
  initialStatus: 'PAUSED',
  adCreatives: [{ ...DEFAULT_CREATIVE }],
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

  // Ad accounts + Pages + Pixels
  const [adAccounts, setAdAccounts] = useState<FbConnection[]>([]);
  const [pages, setPages] = useState<FbConnection[]>([]);
  const [pixels, setPixels] = useState<FbConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  // Derived: selected strategy preset
  const selectedPreset = STRATEGY_PRESETS.find((p) => p.key === state.strategyKey) ?? STRATEGY_PRESETS[0];

  useEffect(() => {
    setSellpagesLoading(true);
    apiGet<SellpagesListResponse>('/sellpages?limit=100')
      .then((res) => setSellpages(res.data ?? []))
      .catch((err) => toastApiError(err as ApiError))
      .finally(() => setSellpagesLoading(false));
  }, []);

  // Fetch ad accounts + pages when entering step 2
  useEffect(() => {
    if (step !== 2) return;
    setConnectionsLoading(true);
    Promise.all([
      apiGet<FbConnection[]>('/fb/connections?connectionType=AD_ACCOUNT'),
      apiGet<FbConnection[]>('/fb/connections?connectionType=PAGE'),
      apiGet<FbConnection[]>('/fb/connections?connectionType=PIXEL'),
    ])
      .then(([accs, pgs, pxls]) => {
        setAdAccounts(accs ?? []);
        setPages(pgs ?? []);
        setPixels(pxls ?? []);
        // Auto-select if only one ad account
        if (accs && accs.length === 1 && !state.adAccountId) {
          update({ adAccountId: accs[0].id });
        }
        // Auto-select if only one page
        if (pgs && pgs.length === 1 && !state.pageId) {
          update({ pageId: pgs[0].id });
        }
        // Auto-select if only one pixel
        if (pxls && pxls.length === 1 && !state.pixelId) {
          update({ pixelId: pxls[0].id });
        }
      })
      .catch((err) => toastApiError(err as ApiError))
      .finally(() => setConnectionsLoading(false));
  }, [step]);

  // Sync adCreatives array when strategy preset changes
  useEffect(() => {
    const needed = selectedPreset.adsPerAdset;
    setState((prev) => {
      const current = prev.adCreatives;
      if (current.length === needed) return prev;
      const next: AdCreativeConfig[] = [];
      for (let i = 0; i < needed; i++) {
        next.push(current[i] ?? { ...DEFAULT_CREATIVE });
      }
      return { ...prev, adCreatives: next };
    });
  }, [selectedPreset.adsPerAdset]);

  function update(patch: Partial<WizardState>) {
    setState((s) => ({ ...s, ...patch }));
    setWizardError(null);
  }

  function canNext(): boolean {
    if (step === 1) return !!state.sellpageId;
    if (step === 2) return !!state.adAccountId && !!state.strategyKey;
    if (step === 3) return !!state.nameTemplate.trim() && !!state.budget && Number(state.budget) > 0 && state.campaignCount >= 1;
    if (step === 4) return true; // creatives are optional
    return true;
  }

  async function handleSubmit() {
    setCreating(true);
    setWizardError(null);
    try {
      const body: CreateCampaignBatchDto = {
        nameTemplate: state.nameTemplate.trim(),
        sellpageId: state.sellpageId,
        adAccountId: state.adAccountId,
        budget: Number(state.budget),
        budgetType: state.budgetType,
        count: state.campaignCount,
        initialStatus: state.initialStatus,
        adsetsPerCampaign: selectedPreset.adsets,
        adsPerAdset: selectedPreset.adsPerAdset,
      };
      if (state.pageId) body.pageId = state.pageId;
      if (state.pixelId) (body as any).pixelId = state.pixelId;
      const validCreatives = state.adCreatives.filter((c) =>
        c.adFormat === 'VIDEO_AD'
          ? c.videoId || c.thumbnailId || c.adtextId || c.headlineId || c.descriptionId
          : c.thumbnailId || c.adtextId || c.headlineId || c.descriptionId,
      );
      if (validCreatives.length > 0) body.adCreatives = validCreatives;

      const result = await apiPost<BatchCreateResponse>('/campaigns/batch', body);
      addToast(`${result.totalCampaigns} campaign(s) created`, 'success');
      // Navigate to first campaign
      if (result.campaigns.length > 0) {
        onCreated(result.campaigns[0].id);
      } else {
        onClose();
      }
    } catch (err) {
      const e = err as ApiError;
      setWizardError(e.message ?? 'Failed to create campaigns');
      toastApiError(e);
    } finally {
      setCreating(false);
    }
  }

  const selectedSellpage = sellpages.find((s) => s.id === state.sellpageId);
  const selectedAdAccount = adAccounts.find((a) => a.id === state.adAccountId);
  const selectedPage = pages.find((p) => p.id === state.pageId);
  const selectedPixel = pixels.find((p) => p.id === state.pixelId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !creating && onClose()} />

      <div className="relative bg-card border border-border rounded-xl w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">New Campaign</h2>
          <button
            onClick={() => !creating && onClose()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
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

          {/* Step 2: Ad Account + Page + Strategy */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Ad Account */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">Ad Account <span className="text-red-400">*</span></h3>
                <p className="text-xs text-muted-foreground mb-3">Choose which Facebook Ad Account to use</p>
                {connectionsLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : adAccounts.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No connected Ad Accounts.{' '}
                    <a href="/settings" className="text-primary underline">Go to Settings</a> to connect one.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {adAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => update({ adAccountId: acc.id })}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm transition-colors ${
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

              {/* Facebook Page */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Facebook Page <span className="text-xs text-muted-foreground/60">(optional)</span>
                </h3>
                <p className="text-xs text-muted-foreground mb-3">Select a page for ad delivery</p>
                {connectionsLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : pages.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No connected Pages found.</div>
                ) : (
                  <select
                    value={state.pageId}
                    onChange={(e) => update({ pageId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">None</option>
                    {pages.map((pg) => (
                      <option key={pg.id} value={pg.id}>
                        {pg.name} ({pg.externalId})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dataset (Pixel) */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Dataset (Pixel) <span className="text-xs text-muted-foreground/60">(optional)</span>
                </h3>
                <p className="text-xs text-muted-foreground mb-3">Select a dataset for conversion tracking (Purchase event)</p>
                {connectionsLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : pixels.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No datasets found. Connect via Facebook Events Manager.</div>
                ) : (
                  <select
                    value={state.pixelId}
                    onChange={(e) => update({ pixelId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">None</option>
                    {pixels.map((px) => (
                      <option key={px.id} value={px.id}>
                        {px.name} ({px.externalId})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Strategy Preset */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">Strategy Preset</h3>
                <p className="text-xs text-muted-foreground mb-3">CBO with Advantage+ targeting, 1-day click attribution</p>
                <div className="grid grid-cols-3 gap-2">
                  {STRATEGY_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => update({ strategyKey: preset.key })}
                      className={`relative px-3 py-3 rounded-lg border text-center transition-colors ${
                        state.strategyKey === preset.key
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap size={12} className="text-primary" />
                        <span className="text-sm font-semibold">{preset.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{preset.totalAds} ads total</p>
                      {state.strategyKey === preset.key && (
                        <Check size={12} className="absolute top-1.5 right-1.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Campaign Config */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground mb-1">Campaign Configuration</h3>

              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Campaign Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={state.nameTemplate}
                  onChange={(e) => update({ nameTemplate: e.target.value })}
                  className={inputCls}
                  placeholder="My Campaign"
                  autoFocus
                />
                {state.campaignCount > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Will generate: {state.nameTemplate || 'My Campaign'} #1, #2, ... #{state.campaignCount}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Campaigns <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={state.campaignCount}
                    onChange={(e) => update({ campaignCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1.5">
                    Budget / campaign <span className="text-red-400">*</span>
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

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Initial Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => update({ initialStatus: 'PAUSED' })}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      state.initialStatus === 'PAUSED'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    Paused (Draft)
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ initialStatus: 'ACTIVE' })}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      state.initialStatus === 'ACTIVE'
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-border bg-muted/30 text-muted-foreground hover:border-green-500/50'
                    }`}
                  >
                    Active
                  </button>
                </div>
              </div>

              {/* Summary box */}
              <div className="bg-muted/30 border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{state.campaignCount}</span> campaign{state.campaignCount > 1 ? 's' : ''} ×{' '}
                <span className="text-foreground font-medium">{selectedPreset.adsets}</span> adsets ×{' '}
                <span className="text-foreground font-medium">{selectedPreset.adsPerAdset}</span> ads ={' '}
                <span className="text-primary font-semibold">{state.campaignCount * selectedPreset.totalAds} total ads</span>
                {state.budget && (
                  <>
                    {' '}| Total budget:{' '}
                    <span className="text-foreground font-medium">
                      ${(Number(state.budget) * state.campaignCount).toFixed(2)}/{state.budgetType === 'DAILY' ? 'day' : 'lifetime'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Creatives */}
          {step === 4 && (
            <CreativeSelector
              adsPerAdset={selectedPreset.adsPerAdset}
              adCreatives={state.adCreatives}
              onAdCreativeChange={(index, config) => {
                const next = [...state.adCreatives];
                next[index] = config;
                update({ adCreatives: next });
              }}
            />
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-4">Review & Create</h3>
              <div className="bg-muted/30 border border-border rounded-lg divide-y divide-border text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-foreground font-medium">{state.nameTemplate}</span>
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
                {selectedPage && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Page</span>
                    <span className="text-foreground">{selectedPage.name}</span>
                  </div>
                )}
                {selectedPixel && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Dataset (Pixel)</span>
                    <span className="text-foreground">{selectedPixel.name} ({selectedPixel.externalId})</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Strategy</span>
                  <span className="text-foreground">{selectedPreset.label}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Campaigns</span>
                  <span className="text-foreground">{state.campaignCount}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="text-foreground">
                    ${state.budget} / {state.budgetType === 'DAILY' ? 'day' : 'lifetime'} / campaign
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Status</span>
                  <span className={state.initialStatus === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}>
                    {state.initialStatus === 'ACTIVE' ? 'Active' : 'Paused (Draft)'}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Total Ads</span>
                  <span className="text-primary font-semibold">{state.campaignCount * selectedPreset.totalAds}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Ad Format</span>
                  <span className="text-foreground">
                    {state.adCreatives[0]?.adFormat === 'IMAGE_AD' ? 'Image Ad' : 'Video Ad'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {state.initialStatus === 'PAUSED'
                  ? 'Campaigns will be created as Draft. You can launch them from the campaign detail page.'
                  : 'Campaigns will be created as Active and will start spending immediately after launch.'}
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
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

          <span className="text-xs text-muted-foreground">
            {step}/{TOTAL_STEPS} — {STEP_LABELS[step - 1]}
          </span>

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
              {creating ? 'Creating...' : `Create ${state.campaignCount} Campaign${state.campaignCount > 1 ? 's' : ''}`}
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
