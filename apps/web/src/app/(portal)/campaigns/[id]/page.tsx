'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  Rocket,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Link2,
  Layers,
  Film,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { fmtDate } from '@/lib/format';
import type {
  CampaignDetail,
  UpdateCampaignDto,
  BudgetType,
  AdsetUnit,
  AdUnit,
  AdUnitDetail,
  AdPostItem,
  AdUnitStatus,
  AdsetUnitsListResponse,
  AdUnitsListResponse,
  CreateAdsetDto,
  CreateAdDto,
  CreateAdPostDto,
  OptimizationGoal,
  FbConnection,
  FbConnectionsResponse,
} from '@/types/api';
import { isDraftCampaign, isDraftAdUnit } from '@/types/api';

// ── Shared status helpers ──
type DisplayStatus = 'draft' | 'active' | 'paused' | 'archived';

const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border border-border' },
  active: { label: 'Active', className: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  paused: { label: 'Paused', className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  archived: { label: 'Archived', className: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};

function getCampaignDisplayStatus(c: Pick<CampaignDetail, 'status' | 'externalCampaignId'>): DisplayStatus {
  if (c.status === 'ARCHIVED') return 'archived';
  if (c.status === 'ACTIVE') return 'active';
  if (isDraftCampaign(c)) return 'draft';
  return 'paused';
}

function getAdUnitDisplayStatus(
  c: { status: AdUnitStatus; externalAdsetId?: string | null; externalAdId?: string | null }
): DisplayStatus {
  if (c.status === 'ARCHIVED') return 'archived';
  if (c.status === 'ACTIVE') return 'active';
  if (isDraftAdUnit(c)) return 'draft';
  return 'paused';
}

function StatusBadge({ ds }: { ds: DisplayStatus }) {
  const cfg = STATUS_CONFIG[ds];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Shared input style ──
const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

const selectCls = inputCls;

// ── Confirmation dialog ──
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClassName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmDialog({ title, message, confirmLabel, confirmClassName, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onCancel()} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-sm mx-4 shadow-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 ${confirmClassName}`}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generic small modal ──
function ModalShell({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">{footer}</div>
      </div>
    </div>
  );
}

// ── Ad row ────────────────────────────────────────────────────────────
interface AdRowProps {
  ad: AdUnit;
  onLinked: (adDetail: AdUnitDetail) => void;
}

function AdRow({ ad, onLinked }: AdRowProps) {
  const addToast = useToastStore((s) => s.add);
  const [adDetail, setAdUnitDetail] = useState<AdUnitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Link Post modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [pages, setPages] = useState<FbConnection[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [linkPageId, setLinkPageId] = useState('');
  const [linkExtPostId, setLinkExtPostId] = useState('');
  const [linking, setLinking] = useState(false);

  const ds = getAdUnitDisplayStatus({ status: ad.status as AdUnitStatus, externalAdId: ad.externalAdId });

  // Lazy-load ad detail when expanded
  const loadDetail = useCallback(async () => {
    if (adDetail || detailLoading) return;
    setDetailLoading(true);
    try {
      const data = await apiGet<AdUnitDetail>(`/ads/${ad.id}`);
      setAdUnitDetail(data);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setDetailLoading(false);
    }
  }, [ad.id, adDetail, detailLoading]);

  function toggleExpand() {
    if (!expanded) loadDetail();
    setExpanded((v) => !v);
  }

  async function openLinkModal() {
    setLinkModalOpen(true);
    setPagesLoading(true);
    try {
      const res = await apiGet<FbConnectionsResponse>('/fb/connections?connectionType=PAGE');
      setPages(res.data);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setPagesLoading(false);
    }
  }

  async function handleLinkPost() {
    if (!linkPageId) return;
    setLinking(true);
    try {
      const body: CreateAdPostDto = { pageId: linkPageId };
      if (linkExtPostId.trim()) body.externalPostId = linkExtPostId.trim();
      const updated = await apiPost<AdUnitDetail>(`/ads/${ad.id}/ad-post`, body);
      addToast('Post linked', 'success');
      setAdUnitDetail(updated);
      onLinked(updated);
      setLinkModalOpen(false);
      setLinkPageId('');
      setLinkExtPostId('');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setLinking(false);
    }
  }

  const linkedPost: AdPostItem | null = adDetail?.adPosts?.[0] ?? null;
  const hasPost = (adDetail?.adPosts?.length ?? 0) > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Ad header row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={toggleExpand}
      >
        <Film size={13} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground font-medium flex-1 truncate">{ad.name}</span>
        <StatusBadge ds={ds} />
        {detailLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        {expanded ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
      </div>

      {/* Ad detail panel */}
      {expanded && (
        <div className="px-4 py-3 border-t border-border bg-muted/5">
          {detailLoading ? (
            <div className="h-8 bg-muted rounded animate-pulse" />
          ) : (
            <div>
              {/* AdPost section */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ad Post</p>
                {!hasPost && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openLinkModal(); }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary bg-primary/10 border border-primary/20
                               rounded-md hover:bg-primary/20 transition-colors"
                  >
                    <Link2 size={11} />
                    Link Post
                  </button>
                )}
              </div>

              {hasPost && linkedPost ? (
                <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Page:</span>
                    <span className="text-foreground font-medium">{linkedPost.pageName ?? linkedPost.pageId}</span>
                  </div>
                  {linkedPost.externalPostId && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Post ID:</span>
                      <code className="text-foreground bg-muted/40 px-1.5 py-0.5 rounded font-mono">
                        {linkedPost.externalPostId}
                      </code>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <span>Linked {fmtDate(linkedPost.createdAt)}</span>
                    {/* Allow re-linking via new button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openLinkModal(); }}
                      className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Link2 size={10} />
                      Change
                    </button>
                  </div>
                </div>
              ) : !detailLoading ? (
                <p className="text-xs text-muted-foreground/60 italic">No post linked yet</p>
              ) : null}

              {/* External ad ID */}
              {ad.externalAdId && (
                <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">
                  External ID: {ad.externalAdId}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Link Post Modal */}
      {linkModalOpen && (
        <ModalShell
          title="Link Ad Post"
          onClose={() => !linking && setLinkModalOpen(false)}
          footer={
            <>
              <button
                onClick={() => setLinkModalOpen(false)}
                disabled={linking}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkPost}
                disabled={linking || !linkPageId}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {linking && <Loader2 size={14} className="animate-spin" />}
                {linking ? 'Linking...' : 'Link Post'}
              </button>
            </>
          }
        >
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Page <span className="text-red-400">*</span>
            </label>
            {pagesLoading ? (
              <div className="h-10 bg-muted rounded animate-pulse" />
            ) : pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No FB Pages connected.{' '}
                <a href="/settings" className="text-primary underline">Go to Settings.</a>
              </p>
            ) : (
              <select
                value={linkPageId}
                onChange={(e) => setLinkPageId(e.target.value)}
                className={selectCls}
              >
                <option value="">Select a page...</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              External Post ID <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={linkExtPostId}
              onChange={(e) => setLinkExtPostId(e.target.value)}
              className={inputCls}
              placeholder="123456789_987654321"
            />
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ── Adset card ────────────────────────────────────────────────────────
interface AdsetCardProps {
  adset: AdsetUnit;
  campaignId: string;
}

function AdsetCard({ adset, campaignId }: AdsetCardProps) {
  const addToast = useToastStore((s) => s.add);
  const [expanded, setExpanded] = useState(false);

  // Ads list
  const [ads, setAds] = useState<AdUnit[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsFetched, setAdsFetched] = useState(false);

  // Add Ad modal
  const [addAdOpen, setAddAdOpen] = useState(false);
  const [newAdName, setNewAdName] = useState('');
  const [creatingAd, setCreatingAd] = useState(false);

  const ds = getAdUnitDisplayStatus({ status: adset.status as AdUnitStatus, externalAdsetId: adset.externalAdsetId });

  const fetchAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const res = await apiGet<AdUnitsListResponse>(`/adsets/${adset.id}/ads?limit=50`);
      setAds(res.data);
      setAdsFetched(true);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setAdsLoading(false);
    }
  }, [adset.id]);

  function toggleExpand() {
    if (!expanded && !adsFetched) fetchAds();
    setExpanded((v) => !v);
  }

  async function handleAddAd(e: FormEvent) {
    e.preventDefault();
    if (!newAdName.trim()) return;
    setCreatingAd(true);
    try {
      const body: CreateAdDto = { name: newAdName.trim() };
      const created = await apiPost<AdUnit>(`/adsets/${adset.id}/ads`, body);
      setAds((prev) => [...prev, created]);
      addToast('Ad created', 'success');
      setNewAdName('');
      setAddAdOpen(false);
      if (!expanded) setExpanded(true);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setCreatingAd(false);
    }
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Adset header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={toggleExpand}
      >
        <Layers size={15} className="text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{adset.name}</p>
          {adset.optimizationGoal && (
            <p className="text-[10px] text-muted-foreground">Goal: {adset.optimizationGoal}</p>
          )}
        </div>
        <StatusBadge ds={ds} />
        {adsLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        {!adsLoading && adsFetched && (
          <span className="text-[10px] text-muted-foreground">{ads.length} ad{ads.length !== 1 ? 's' : ''}</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setAddAdOpen(true); }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground bg-muted border border-border rounded-md
                     hover:text-foreground hover:border-primary/50 transition-colors"
          title="Add Ad"
        >
          <Plus size={10} />
          Ad
        </button>
        {expanded ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
      </div>

      {/* Ads list */}
      {expanded && (
        <div className="border-t border-border">
          {adsLoading ? (
            <div className="p-4 space-y-2">
              <div className="h-9 bg-muted rounded animate-pulse" />
              <div className="h-9 bg-muted rounded animate-pulse" />
            </div>
          ) : ads.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No ads yet</p>
              <button
                onClick={() => setAddAdOpen(true)}
                className="mt-2 flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs text-primary bg-primary/10 border border-primary/20
                           rounded-md hover:bg-primary/20 transition-colors"
              >
                <Plus size={11} />
                Add First Ad
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-2 ml-4 border-l-2 border-border">
              {ads.map((ad) => (
                <AdRow
                  key={ad.id}
                  ad={ad}
                  onLinked={() => { /* detail already updated inside AdRow */ }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Ad Modal */}
      {addAdOpen && (
        <ModalShell
          title="Add Ad"
          onClose={() => !creatingAd && setAddAdOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setAddAdOpen(false)}
                disabled={creatingAd}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAd}
                disabled={creatingAd || !newAdName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {creatingAd && <Loader2 size={14} className="animate-spin" />}
                {creatingAd ? 'Creating...' : 'Create Ad'}
              </button>
            </>
          }
        >
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Ad Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newAdName}
              onChange={(e) => setNewAdName(e.target.value)}
              className={inputCls}
              placeholder="My Ad"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddAd(e as unknown as FormEvent); }}
            />
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ── Adsets Section ────────────────────────────────────────────────────
interface AdsetsSectionProps {
  campaignId: string;
}

function AdsetsSection({ campaignId }: AdsetsSectionProps) {
  const addToast = useToastStore((s) => s.add);
  const [adsets, setAdsets] = useState<AdsetUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Add Adset modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState<OptimizationGoal | ''>('');
  const [newTargeting, setNewTargeting] = useState('');
  const [targetingError, setTargetingError] = useState('');
  const [creating, setCreating] = useState(false);

  const GOALS: { value: OptimizationGoal; label: string }[] = [
    { value: 'CONVERSIONS', label: 'Conversions' },
    { value: 'LINK_CLICKS', label: 'Link Clicks' },
    { value: 'IMPRESSIONS', label: 'Impressions' },
    { value: 'REACH', label: 'Reach' },
  ];

  const fetchAdsets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<AdsetUnitsListResponse>(`/campaigns/${campaignId}/adsets?limit=50`);
      setAdsets(res.data);
      setFetched(true);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Fetch on first render
  useEffect(() => {
    fetchAdsets();
  }, [fetchAdsets]);

  function validateTargeting(): Record<string, unknown> | null {
    if (!newTargeting.trim()) return null;
    try {
      const parsed = JSON.parse(newTargeting.trim());
      setTargetingError('');
      return parsed as Record<string, unknown>;
    } catch {
      setTargetingError('Invalid JSON');
      return undefined as unknown as null;
    }
  }

  async function handleAddAdset(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    const targeting = validateTargeting();
    if (targeting === undefined) return; // JSON parse failed

    setCreating(true);
    try {
      const body: CreateAdsetDto = { name: newName.trim() };
      if (newGoal) body.optimizationGoal = newGoal;
      if (targeting) body.targeting = targeting;

      const created = await apiPost<AdsetUnit>(`/campaigns/${campaignId}/adsets`, body);
      setAdsets((prev) => [...prev, created]);
      addToast('Adset created', 'success');
      setNewName('');
      setNewGoal('');
      setNewTargeting('');
      setAddOpen(false);
      setExpanded(true);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-border cursor-pointer hover:bg-muted/10 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers size={15} />
            Adsets
          </h2>
          {fetched && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {adsets.length}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAddOpen(true); setExpanded(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium
                     hover:bg-primary/20 transition-colors"
        >
          <Plus size={12} />
          Add Adset
        </button>
      </div>

      {/* Adsets list */}
      {expanded && (
        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-12 bg-muted rounded-lg animate-pulse" />
              <div className="h-12 bg-muted rounded-lg animate-pulse" />
            </div>
          ) : adsets.length === 0 ? (
            <div className="text-center py-8">
              <Layers size={28} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No adsets yet</p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-3 flex items-center gap-1.5 mx-auto px-3 py-1.5 text-xs text-primary bg-primary/10 border border-primary/20
                           rounded-md hover:bg-primary/20 transition-colors"
              >
                <Plus size={11} />
                Create First Adset
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {adsets.map((adset) => (
                <AdsetCard key={adset.id} adset={adset} campaignId={campaignId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Adset Modal */}
      {addOpen && (
        <ModalShell
          title="Add Adset"
          onClose={() => !creating && setAddOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={creating}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAdset}
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                {creating ? 'Creating...' : 'Create Adset'}
              </button>
            </>
          }
        >
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Adset Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputCls}
              placeholder="My Adset"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Optimization Goal <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            <select
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value as OptimizationGoal | '')}
              className={selectCls}
            >
              <option value="">Select goal...</option>
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Targeting <span className="text-xs text-muted-foreground/60">(optional JSON)</span>
            </label>
            <textarea
              value={newTargeting}
              onChange={(e) => { setNewTargeting(e.target.value); setTargetingError(''); }}
              className={`${inputCls} h-20 resize-none font-mono text-xs`}
              placeholder={'{\n  "age_min": 18,\n  "age_max": 65\n}'}
            />
            {targetingError && (
              <p className="text-xs text-red-400 mt-1">{targetingError}</p>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode ──
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editBudgetType, setEditBudgetType] = useState<BudgetType>('DAILY');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // ── Action states ──
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'launch' | 'pause' | 'resume' | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<CampaignDetail>(`/campaigns/${id}`);
      setCampaign(data);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load campaign');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  function startEditing() {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditBudget(campaign.budgetPerDay != null ? String(campaign.budgetPerDay) : '');
    setEditBudgetType(campaign.budgetType);
    setEditStartDate(campaign.startDate ? campaign.startDate.slice(0, 10) : '');
    setEditEndDate(campaign.endDate ? campaign.endDate.slice(0, 10) : '');
    setEditing(true);
  }

  function cancelEditing() { setEditing(false); }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!campaign || !editName.trim()) return;
    setSaving(true);
    try {
      const body: UpdateCampaignDto = {};
      if (editName.trim() !== campaign.name) body.name = editName.trim();
      const newBudget = editBudget ? Number(editBudget) : undefined;
      if (newBudget !== undefined && newBudget !== (campaign.budgetPerDay ?? undefined)) body.budget = newBudget;
      if (editBudgetType !== campaign.budgetType) body.budgetType = editBudgetType;
      const newStart = editStartDate || null;
      const oldStart = campaign.startDate ? campaign.startDate.slice(0, 10) : null;
      if (newStart !== oldStart) body.startDate = newStart ?? undefined;
      const newEnd = editEndDate || null;
      const oldEnd = campaign.endDate ? campaign.endDate.slice(0, 10) : null;
      if (newEnd !== oldEnd) body.endDate = newEnd ?? undefined;

      const updated = await apiPatch<CampaignDetail>(`/campaigns/${campaign.id}`, body);
      setCampaign(updated);
      setEditing(false);
      addToast('Campaign updated', 'success');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  async function executeAction(action: 'launch' | 'pause' | 'resume') {
    if (!campaign) return;
    setActionLoading(true);
    setConfirmAction(null);
    try {
      let updated: CampaignDetail;
      if (action === 'launch') {
        updated = await apiPost<CampaignDetail>(`/campaigns/${campaign.id}/launch`, {});
        addToast('Campaign launched', 'success');
      } else if (action === 'pause') {
        updated = await apiPatch<CampaignDetail>(`/campaigns/${campaign.id}/pause`, {});
        addToast('Campaign paused', 'success');
      } else {
        updated = await apiPatch<CampaignDetail>(`/campaigns/${campaign.id}/resume`, {});
        addToast('Campaign resumed', 'success');
      }
      setCampaign(updated);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Campaign not found'}
        </div>
      </div>
    );
  }

  const ds = getCampaignDisplayStatus(campaign);
  const isDraft = ds === 'draft';
  const isActive = ds === 'active';
  const isPaused = ds === 'paused';

  const CONFIRM_CONFIG = {
    launch: {
      title: 'Launch Campaign?',
      message: `This will publish "${campaign.name}" to Facebook Ads and start delivery.`,
      confirmLabel: 'Launch',
      confirmClassName: 'bg-green-600 hover:bg-green-500',
    },
    pause: {
      title: 'Pause Campaign?',
      message: `This will pause delivery for "${campaign.name}".`,
      confirmLabel: 'Pause',
      confirmClassName: 'bg-yellow-600 hover:bg-yellow-500',
    },
    resume: {
      title: 'Resume Campaign?',
      message: `This will resume delivery for "${campaign.name}".`,
      confirmLabel: 'Resume',
      confirmClassName: 'bg-green-600 hover:bg-green-500',
    },
  };

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => router.push('/campaigns')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Back to Campaigns
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground truncate">{campaign.name}</h1>
            <StatusBadge ds={ds} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">ID: {campaign.id}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDraft && (
            <button onClick={() => setConfirmAction('launch')} disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Launch Campaign
            </button>
          )}
          {isActive && (
            <button onClick={() => setConfirmAction('pause')} disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium
                         hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
              Pause
            </button>
          )}
          {isPaused && (
            <button onClick={() => setConfirmAction('resume')} disabled={actionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              Resume
            </button>
          )}
          {!editing ? (
            <button onClick={startEditing}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors">
              <Pencil size={14} />
              Edit
            </button>
          ) : (
            <button onClick={cancelEditing} disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50">
              <X size={14} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSave} className="bg-card border border-primary/20 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">Edit Campaign</h2>
          <div>
            <label htmlFor="edit-name" className="block text-sm text-muted-foreground mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input id="edit-name" type="text" value={editName} required
              onChange={(e) => setEditName(e.target.value)} className={inputCls} placeholder="Campaign name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-budget" className="block text-sm text-muted-foreground mb-1.5">Budget</label>
              <input id="edit-budget" type="number" min="1" step="0.01" value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)} className={inputCls} placeholder="50" />
            </div>
            <div>
              <label htmlFor="edit-budget-type" className="block text-sm text-muted-foreground mb-1.5">Budget Type</label>
              <select id="edit-budget-type" value={editBudgetType}
                onChange={(e) => setEditBudgetType(e.target.value as BudgetType)} className={inputCls}>
                <option value="DAILY">Daily</option>
                <option value="LIFETIME">Lifetime</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-start" className="block text-sm text-muted-foreground mb-1.5">
                Start Date <span className="text-xs text-muted-foreground/60">(optional)</span>
              </label>
              <input id="edit-start" type="date" value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="edit-end" className="block text-sm text-muted-foreground mb-1.5">
                End Date <span className="text-xs text-muted-foreground/60">(optional)</span>
              </label>
              <input id="edit-end" type="date" value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={cancelEditing} disabled={saving}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !editName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Sellpage</h2>
          {campaign.sellpage ? (
            <>
              <p className="text-sm font-medium text-foreground">{campaign.sellpage.urlPreview}</p>
              <p className="text-xs text-muted-foreground mt-1">Slug: {campaign.sellpage.slug}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{campaign.sellpageId}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Ad Account</h2>
          <p className="text-sm font-medium text-foreground">{campaign.adAccountName ?? campaign.adAccountId}</p>
          {campaign.platform && <p className="text-xs text-muted-foreground mt-1">Platform: {campaign.platform}</p>}
          {campaign.externalCampaignId && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">External ID: {campaign.externalCampaignId}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Budget</h2>
          <p className="text-2xl font-bold text-foreground">
            {campaign.budgetPerDay != null ? `$${campaign.budgetPerDay}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {campaign.budgetType === 'DAILY' ? 'Per day' : 'Lifetime total'}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Schedule</h2>
          <div className="space-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Start: </span>
              <span className="text-foreground">{campaign.startDate ? fmtDate(campaign.startDate) : 'Immediately'}</span></div>
            <div><span className="text-muted-foreground">End: </span>
              <span className="text-foreground">{campaign.endDate ? fmtDate(campaign.endDate) : 'No end date'}</span></div>
            <div><span className="text-muted-foreground">Created: </span>
              <span className="text-foreground">{fmtDate(campaign.createdAt)}</span></div>
            <div><span className="text-muted-foreground">Updated: </span>
              <span className="text-foreground">{fmtDate(campaign.updatedAt)}</span></div>
          </div>
        </div>
      </div>

      {campaign.deliveryStatus && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Delivery Status</h2>
          <p className="text-sm text-foreground">{campaign.deliveryStatus}</p>
        </div>
      )}

      {/* ── Adsets section ── */}
      <AdsetsSection campaignId={campaign.id} />

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          {...CONFIRM_CONFIG[confirmAction]}
          loading={actionLoading}
          onConfirm={() => executeAction(confirmAction)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
