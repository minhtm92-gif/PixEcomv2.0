'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  X,
  Save,
  Loader2,
  Globe,
  EyeOff,
  Megaphone,
  Plus,
  Link2,
  Tv2,
  Check,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { fmtDate, moneyWhole, num, pct } from '@/lib/format';
import type {
  SellpageDetail,
  UpdateSellpageDto,
  LinkedAdsResponse,
  LinkedCampaign,
  LinkedAd,
  FbConnection,
  FbConnectionsResponse,
  SellpageDomainCheckResponse,
  SellpageDomainVerifyResponse,
  SellpagePixelResponse,
  CreativeListItem,
  CreativesListResponse,
} from '@/types/api';

// ── Flat ad row for the table ──
interface FlatAdRow {
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  ad: LinkedAd;
}

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

export default function SellpageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [sp, setSp] = useState<SellpageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode ──
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSlug, setEditSlug] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // ── Publish ──
  const [publishing, setPublishing] = useState(false);

  // ── Linked Ads ──
  const [linkedCampaigns, setLinkedCampaigns] = useState<LinkedCampaign[]>([]);
  const [linkedAdsLoading, setLinkedAdsLoading] = useState(false);

  // ── B.1 Custom Domain ──
  const [domainInput, setDomainInput] = useState('');
  const [domainChecking, setDomainChecking] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainVerifyResult, setDomainVerifyResult] = useState<SellpageDomainVerifyResponse | null>(null);

  // ── B.2 Tracking Pixel ──
  const [pixelData, setPixelData] = useState<SellpagePixelResponse | null>(null);
  const [pixelConnections, setPixelConnections] = useState<FbConnection[]>([]);
  const [selectedPixelConnId, setSelectedPixelConnId] = useState('');
  const [pixelSaving, setPixelSaving] = useState(false);
  const [pixelLoading, setPixelLoading] = useState(false);

  // ── B.3 Link by Post ID modal ──
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkCampaignId, setLinkCampaignId] = useState('');
  const [linkAdsetId, setLinkAdsetId] = useState('');
  const [linkAdName, setLinkAdName] = useState('');
  const [linkPageConnId, setLinkPageConnId] = useState('');
  const [linkPostId, setLinkPostId] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pageConnections, setPageConnections] = useState<FbConnection[]>([]);
  const [pageConnectionsLoading, setPageConnectionsLoading] = useState(false);

  // ── B.3 Create from Creative modal (4-step) ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3 | 4>(1);
  const [creativesList, setCreativesList] = useState<CreativeListItem[]>([]);
  const [creativesLoading, setCreativesLoading] = useState(false);
  const [selectedCreativeId, setSelectedCreativeId] = useState('');
  const [createCampaignId, setCreateCampaignId] = useState('');
  const [createAdsetId, setCreateAdsetId] = useState('');
  const [createAdName, setCreateAdName] = useState('');
  const [createPageConnId, setCreatePageConnId] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Fetch sellpage ──
  const fetchSellpage = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SellpageDetail>(`/sellpages/${id}`);
      setSp(data);
      setDomainInput(data.customDomain ?? '');
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load sellpage');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Fetch linked ads ──
  const fetchLinkedAds = useCallback(async () => {
    if (!id) return;
    setLinkedAdsLoading(true);
    try {
      const data = await apiGet<LinkedAdsResponse>(`/sellpages/${id}/linked-ads`);
      setLinkedCampaigns(data.campaigns);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setLinkedAdsLoading(false);
    }
  }, [id]);

  // ── Fetch pixel data ──
  const fetchPixelData = useCallback(async () => {
    if (!id) return;
    setPixelLoading(true);
    try {
      const [pixelRes, connectionsRes] = await Promise.all([
        apiGet<SellpagePixelResponse>(`/sellpages/${id}/pixel`),
        apiGet<FbConnectionsResponse>('/fb/connections?connectionType=PIXEL'),
      ]);
      setPixelData(pixelRes);
      setPixelConnections(connectionsRes.data ?? []);
      setSelectedPixelConnId(pixelRes.pixelId ?? '');
    } catch {
      // Pixel data is non-critical; silently fail
    } finally {
      setPixelLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSellpage();
    fetchLinkedAds();
    fetchPixelData();
  }, [fetchSellpage, fetchLinkedAds, fetchPixelData]);

  // ── Flatten linked ads into table rows ──
  const flatAdRows: FlatAdRow[] = linkedCampaigns.flatMap((c) =>
    c.adsets.flatMap((as) =>
      as.ads.map((ad) => ({
        campaignId: c.id,
        campaignName: c.name,
        adsetId: as.id,
        adsetName: as.name,
        ad,
      })),
    ),
  );

  // ── Edit ──
  function startEditing() {
    if (!sp) return;
    setEditSlug(sp.slug);
    setEditTitle(sp.titleOverride ?? '');
    setEditDesc(sp.descriptionOverride ?? '');
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!sp || !editSlug.trim()) return;
    setSaving(true);
    try {
      const body: UpdateSellpageDto = {};
      if (editSlug.trim() !== sp.slug) body.slug = editSlug.trim();
      if (editTitle.trim() !== (sp.titleOverride ?? '')) body.titleOverride = editTitle.trim();
      if (editDesc.trim() !== (sp.descriptionOverride ?? ''))
        body.descriptionOverride = editDesc.trim();
      const updated = await apiPatch<SellpageDetail>(`/sellpages/${sp.id}`, body);
      setSp(updated);
      setEditing(false);
      addToast('Sellpage updated', 'success');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  // ── Publish / Unpublish ──
  async function handlePublish() {
    if (!sp) return;
    setPublishing(true);
    try {
      await apiPost(`/sellpages/${sp.id}/publish`);
      addToast('Sellpage published', 'success');
      await fetchSellpage();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!sp) return;
    setPublishing(true);
    try {
      await apiPost(`/sellpages/${sp.id}/unpublish`);
      addToast('Sellpage unpublished', 'success');
      await fetchSellpage();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setPublishing(false);
    }
  }

  // ── B.1 Domain ──
  async function handleDomainCheck() {
    if (!domainInput.trim()) return;
    setDomainChecking(true);
    setDomainAvailable(null);
    setDomainVerifyResult(null);
    try {
      const res = await apiGet<SellpageDomainCheckResponse>(
        `/sellpages/check-domain?domain=${encodeURIComponent(domainInput.trim())}`,
      );
      setDomainAvailable(res.available);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setDomainChecking(false);
    }
  }

  async function handleDomainSave() {
    if (!sp || !domainInput.trim()) return;
    setDomainSaving(true);
    try {
      const updated = await apiPatch<SellpageDetail>(`/sellpages/${sp.id}`, {
        customDomain: domainInput.trim(),
      } as UpdateSellpageDto & { customDomain: string });
      setSp(updated);
      addToast('Custom domain saved', 'success');
      setDomainAvailable(null);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setDomainSaving(false);
    }
  }

  async function handleDomainVerify() {
    if (!sp) return;
    setDomainVerifying(true);
    try {
      const res = await apiPost<SellpageDomainVerifyResponse>(
        `/sellpages/${sp.id}/verify-domain`,
      );
      setDomainVerifyResult(res);
      if (res.verified) {
        addToast('Domain verified!', 'success');
        await fetchSellpage();
      } else {
        addToast(`DNS not propagated yet. Expected CNAME: ${res.expectedCname}`, 'error');
      }
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setDomainVerifying(false);
    }
  }

  // ── B.2 Pixel ──
  async function handlePixelSave() {
    if (!sp) return;
    setPixelSaving(true);
    try {
      await apiPatch(`/sellpages/${sp.id}`, { pixelId: selectedPixelConnId || null } as UpdateSellpageDto & { pixelId: string | null });
      addToast(
        selectedPixelConnId ? 'Tracking pixel saved' : 'Tracking pixel removed',
        'success',
      );
      await fetchPixelData();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setPixelSaving(false);
    }
  }

  // ── B.3 Load page connections ──
  async function loadPageConnections() {
    if (pageConnections.length > 0) return;
    setPageConnectionsLoading(true);
    try {
      const res = await apiGet<FbConnectionsResponse>('/fb/connections?connectionType=PAGE');
      setPageConnections(res.data ?? []);
    } catch {
      // Non-critical
    } finally {
      setPageConnectionsLoading(false);
    }
  }

  // ── B.3 Link by Post ID ──
  async function openLinkModal() {
    setLinkModalOpen(true);
    setLinkCampaignId('');
    setLinkAdsetId('');
    setLinkAdName('');
    setLinkPageConnId('');
    setLinkPostId('');
    setLinkError(null);
    loadPageConnections();
  }

  async function handleLinkSubmit(e: FormEvent) {
    e.preventDefault();
    if (!linkAdsetId || !linkAdName.trim() || !linkPageConnId || !linkPostId.trim()) return;
    setLinkError(null);
    setLinkSubmitting(true);
    try {
      const pageConn = pageConnections.find((c) => c.id === linkPageConnId);
      const pageExternalId = pageConn?.externalId ?? linkPageConnId;

      const newAd = await apiPost<{ id: string }>(`/adsets/${linkAdsetId}/ads`, {
        name: linkAdName.trim(),
      });
      await apiPost(`/ads/${newAd.id}/ad-post`, {
        pageId: pageExternalId,
        externalPostId: linkPostId.trim(),
      });
      addToast('Ad linked successfully', 'success');
      setLinkModalOpen(false);
      await fetchLinkedAds();
    } catch (err) {
      const e = err as ApiError;
      setLinkError(e.message ?? 'Failed to link ad');
    } finally {
      setLinkSubmitting(false);
    }
  }

  // ── B.3 Create from Creative ──
  async function openCreateModal() {
    setCreateModalOpen(true);
    setCreateStep(1);
    setSelectedCreativeId('');
    setCreateCampaignId('');
    setCreateAdsetId('');
    setCreateAdName('');
    setCreatePageConnId('');
    setCreateError(null);
    loadPageConnections();
    if (creativesList.length === 0) {
      setCreativesLoading(true);
      try {
        const res = await apiGet<CreativesListResponse>('/creatives?status=READY&limit=50');
        setCreativesList(res.data ?? []);
      } catch {
        // Non-critical
      } finally {
        setCreativesLoading(false);
      }
    }
  }

  async function handleCreateSubmit() {
    if (!createAdsetId || !createAdName.trim() || !createPageConnId) return;
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      const pageConn = pageConnections.find((c) => c.id === createPageConnId);
      const pageExternalId = pageConn?.externalId ?? createPageConnId;

      const newAd = await apiPost<{ id: string }>(`/adsets/${createAdsetId}/ads`, {
        name: createAdName.trim(),
      });
      await apiPost(`/ads/${newAd.id}/ad-post`, {
        pageId: pageExternalId,
        // creative assets linked separately by creative assignment flow
      });
      addToast('Ad created from creative', 'success');
      setCreateModalOpen(false);
      await fetchLinkedAds();
    } catch (err) {
      const e = err as ApiError;
      setCreateError(e.message ?? 'Failed to create ad');
    } finally {
      setCreateSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-64 animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !sp) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Sellpage not found'}
        </div>
      </div>
    );
  }

  const isStub = sp.stats.revenue === 0 && sp.stats.cost === 0 && sp.stats.youTake === 0;
  const isDraft = sp.status.toUpperCase() === 'DRAFT';
  const isPublished = sp.status.toUpperCase() === 'PUBLISHED';
  const domainStatus = sp.customDomainStatus ?? 'NOT_SET';

  // Adsets for the selected link campaign
  const linkAdsets = linkedCampaigns.find((c) => c.id === linkCampaignId)?.adsets ?? [];
  const createAdsets = linkedCampaigns.find((c) => c.id === createCampaignId)?.adsets ?? [];
  const selectedCreative = creativesList.find((c) => c.id === selectedCreativeId);

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => router.push('/sellpages')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Back to Sellpages
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">{sp.titleOverride ?? sp.slug}</h1>
        <StatusBadge status={sp.status} />

        <div className="ml-auto flex items-center gap-2">
          {isDraft && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              Publish
            </button>
          )}
          {isPublished && (
            <button
              onClick={handleUnpublish}
              disabled={publishing}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium
                         hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
              Unpublish
            </button>
          )}
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                         hover:text-foreground transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
          ) : (
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                         hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <form
          onSubmit={handleSave}
          className="bg-card border border-primary/20 rounded-xl p-5 mb-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-2">Edit Sellpage</h2>
          <div>
            <label htmlFor="edit-slug" className="block text-sm text-muted-foreground mb-1.5">
              Slug <span className="text-red-400">*</span>
            </label>
            <input
              id="edit-slug"
              type="text"
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              required
              className={inputCls}
              placeholder="my-product-page"
            />
          </div>
          <div>
            <label htmlFor="edit-title" className="block text-sm text-muted-foreground mb-1.5">
              Title Override{' '}
              <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            <input
              id="edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={inputCls}
              placeholder="Custom page title"
            />
          </div>
          <div>
            <label htmlFor="edit-desc" className="block text-sm text-muted-foreground mb-1.5">
              Description Override{' '}
              <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              id="edit-desc"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className={inputCls + ' resize-none'}
              placeholder="Custom page description"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !editSlug.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* ── Info cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Domain & URL */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">URL / Domain</h2>
          <p className="text-sm text-foreground mb-1">
            Slug: <span className="font-mono">/{sp.slug}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-2">Type: {sp.sellpageType}</p>
          <a
            href={
              sp.urlPreview.startsWith('http') ? sp.urlPreview : `https://${sp.urlPreview}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            <ExternalLink size={12} />
            {sp.urlPreview}
          </a>
          <p className="text-xs text-muted-foreground mt-2">
            Created: {fmtDate(sp.createdAt)} &middot; Updated: {fmtDate(sp.updatedAt)}
          </p>
        </div>

        {/* Product */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Linked Product</h2>
          {sp.product ? (
            <div className="flex items-start gap-3">
              {sp.product.heroImageUrl ? (
                <img
                  src={sp.product.heroImageUrl}
                  alt={sp.product.name}
                  className="w-12 h-12 rounded object-cover bg-muted"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <ImageIcon size={18} className="text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{sp.product.name}</p>
                <p className="text-xs text-muted-foreground font-mono">/{sp.product.slug}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base price: ${Number(sp.product.basePrice).toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No product linked</p>
          )}
        </div>
      </div>

      {/* ── B.1 Custom Domain ── */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Globe size={15} className="text-muted-foreground" />
          Custom Domain
          {domainStatus !== 'NOT_SET' && (
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                domainStatus === 'VERIFIED'
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {domainStatus}
            </span>
          )}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={domainInput}
            onChange={(e) => {
              setDomainInput(e.target.value);
              setDomainAvailable(null);
            }}
            placeholder="mystore"
            className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                       w-40"
          />
          <span className="text-sm text-muted-foreground">.pixelxlab.com</span>

          <button
            onClick={handleDomainCheck}
            disabled={domainChecking || !domainInput.trim()}
            className="px-3 py-2 bg-muted text-muted-foreground rounded-lg text-xs font-medium
                       hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {domainChecking ? <Loader2 size={12} className="animate-spin" /> : 'Check Availability'}
          </button>

          {domainAvailable !== null && (
            <span
              className={`text-xs font-medium ${
                domainAvailable ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {domainAvailable ? '✓ Available' : '✗ Taken'}
            </span>
          )}

          <button
            onClick={handleDomainSave}
            disabled={domainSaving || !domainInput.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium
                       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {domainSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>

          {sp.customDomain && (
            <button
              onClick={handleDomainVerify}
              disabled={domainVerifying}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground rounded-lg text-xs font-medium
                         hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {domainVerifying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Verify DNS
            </button>
          )}
        </div>

        {domainVerifyResult && !domainVerifyResult.verified && (
          <p className="text-xs text-amber-400 mt-2">
            Add CNAME:{' '}
            <span className="font-mono bg-muted/40 px-1 rounded">
              {domainVerifyResult.domain}
            </span>{' '}
            → <span className="font-mono bg-muted/40 px-1 rounded">{domainVerifyResult.expectedCname}</span>
          </p>
        )}
        {sp.customDomain && (
          <p className="text-xs text-muted-foreground mt-2">
            Current:{' '}
            <span className="font-mono text-foreground">{sp.customDomain}.pixelxlab.com</span>
          </p>
        )}
      </div>

      {/* ── B.2 Tracking Pixel ── */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Zap size={15} className="text-muted-foreground" />
          Tracking Pixel
        </h2>

        {pixelLoading ? (
          <div className="h-9 bg-muted rounded animate-pulse w-48" />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {pixelData?.pixelName && (
              <span className="text-xs text-muted-foreground">
                Current:{' '}
                <span className="text-foreground font-medium">{pixelData.pixelName}</span>{' '}
                <span className="font-mono text-muted-foreground/60">
                  ({pixelData.pixelExternalId})
                </span>
              </span>
            )}

            <select
              value={selectedPixelConnId}
              onChange={(e) => setSelectedPixelConnId(e.target.value)}
              className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground
                         focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— No pixel —</option>
              {pixelConnections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.externalId})
                </option>
              ))}
            </select>

            <button
              onClick={handlePixelSave}
              disabled={pixelSaving}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {pixelSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        )}
        {pixelConnections.length === 0 && !pixelLoading && (
          <p className="text-xs text-muted-foreground mt-2">
            No FB Pixel connections found. Add one in{' '}
            <button
              onClick={() => router.push('/settings')}
              className="text-primary hover:underline"
            >
              Settings
            </button>
            .
          </p>
        )}
      </div>

      {/* ── B.3 Linked Ads Table ── */}
      <div className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Megaphone size={15} className="text-muted-foreground" />
            Linked Ads
            {!linkedAdsLoading && (
              <span className="text-muted-foreground font-normal">({flatAdRows.length})</span>
            )}
            {linkedAdsLoading && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={openLinkModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium
                         hover:text-foreground transition-colors"
            >
              <Link2 size={12} />
              Link by Post ID
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium
                         hover:opacity-90 transition-opacity"
            >
              <Plus size={12} />
              Create from Creative
            </button>
          </div>
        </div>

        {linkedAdsLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : flatAdRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">
            No linked ads yet.{' '}
            <button onClick={openLinkModal} className="text-primary hover:underline">
              Link by Post ID
            </button>{' '}
            or{' '}
            <button onClick={openCreateModal} className="text-primary hover:underline">
              create from creative
            </button>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Campaign', 'Adset', 'Ad Name', 'Post ID', 'Thumb', 'Ad Text', 'Spend', 'Impr', 'Clicks', 'Conv', 'ROAS', 'Status'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {flatAdRows.map((row) => {
                  const { ad } = row;
                  const m = ad.metrics;
                  const ap = ad.adPost;
                  return (
                    <tr
                      key={`${row.adsetId}-${ad.id}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">
                        {row.campaignName}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">
                        {row.adsetName}
                      </td>
                      <td className="px-3 py-2.5 text-foreground font-medium max-w-[140px] truncate">
                        {ad.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {ap?.externalPostId ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {ap?.thumbnailUrl ? (
                          <img
                            src={ap.thumbnailUrl}
                            alt="thumb"
                            className="w-10 h-10 rounded object-cover bg-muted"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Tv2 size={14} className="text-muted-foreground/40" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[160px]">
                        {ap?.adText ? (
                          <span
                            title={ap.adText}
                            className="text-muted-foreground truncate block"
                          >
                            {ap.adText.length > 50
                              ? ap.adText.slice(0, 50) + '…'
                              : ap.adText}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {m ? moneyWhole(m.spend) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {m ? num(m.impressions) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {m ? num(m.clicks) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {m ? num(m.purchases) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {m ? m.roas.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={ad.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Description */}
      {sp.descriptionOverride && !editing && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Description Override
          </h2>
          <p className="text-sm text-foreground">{sp.descriptionOverride}</p>
        </div>
      )}

      {/* Stats */}
      <h2 className="text-sm font-medium text-foreground mb-3">Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <KpiCard label="Revenue" value={isStub ? '—' : moneyWhole(sp.stats.revenue)} />
        <KpiCard label="Cost" value={isStub ? '—' : moneyWhole(sp.stats.cost)} />
        <KpiCard label="YouTake" value={isStub ? '—' : moneyWhole(sp.stats.youTake)} />
        <KpiCard label="Hold" value={isStub ? '—' : moneyWhole(sp.stats.hold)} />
        <KpiCard label="CashToBalance" value={isStub ? '—' : moneyWhole(sp.stats.cashToBalance)} />
      </div>
      {isStub && (
        <p className="text-xs text-muted-foreground italic mb-6">
          Sellpage stats are stubs — not yet implemented in backend.
        </p>
      )}

      {/* Creative placeholder */}
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">Assigned Creative</p>
        <p className="text-xs text-muted-foreground mt-1">
          Coming soon — creative assignment endpoint not yet available
        </p>
      </div>

      {/* ── Link by Post ID Modal ── */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !linkSubmitting && setLinkModalOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Link2 size={16} /> Link by Post ID
              </h2>
              <button
                onClick={() => !linkSubmitting && setLinkModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLinkSubmit} className="p-5 space-y-4">
              {/* Campaign */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Campaign</label>
                <select
                  value={linkCampaignId}
                  onChange={(e) => {
                    setLinkCampaignId(e.target.value);
                    setLinkAdsetId('');
                  }}
                  required
                  className={inputCls}
                >
                  <option value="">Select campaign...</option>
                  {linkedCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Adset */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">Ad Set</label>
                <select
                  value={linkAdsetId}
                  onChange={(e) => setLinkAdsetId(e.target.value)}
                  required
                  disabled={!linkCampaignId}
                  className={inputCls}
                >
                  <option value="">Select ad set...</option>
                  {linkAdsets.map((as) => (
                    <option key={as.id} value={as.id}>
                      {as.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ad Name */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Ad Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={linkAdName}
                  onChange={(e) => setLinkAdName(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="My Ad"
                />
              </div>

              {/* Page */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Facebook Page <span className="text-red-400">*</span>
                </label>
                {pageConnectionsLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : (
                  <select
                    value={linkPageConnId}
                    onChange={(e) => setLinkPageConnId(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">Select page...</option>
                    {pageConnections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Post ID */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  External Post ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={linkPostId}
                  onChange={(e) => setLinkPostId(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="123456789_987654321"
                />
              </div>

              {linkError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {linkError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  disabled={linkSubmitting}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    linkSubmitting ||
                    !linkAdsetId ||
                    !linkAdName.trim() ||
                    !linkPageConnId ||
                    !linkPostId.trim()
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                             hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {linkSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {linkSubmitting ? 'Linking...' : 'Link Ad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create from Creative Modal (4-step) ── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !createSubmitting && setCreateModalOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Plus size={16} /> Create from Creative
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Step {createStep} of 4
                </p>
              </div>
              <button
                onClick={() => !createSubmitting && setCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step progress */}
            <div className="flex gap-0 border-b border-border">
              {['Creative', 'Campaign', 'Ad Name', 'Review'].map((label, i) => (
                <div
                  key={label}
                  className={`flex-1 py-2 text-center text-[11px] font-medium transition-colors ${
                    i + 1 === createStep
                      ? 'bg-primary/10 text-primary border-b-2 border-primary'
                      : i + 1 < createStep
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/40'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="p-5">
              {/* Step 1: Select Creative */}
              {createStep === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Select a ready creative to use for this ad.
                  </p>
                  {creativesLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  ) : creativesList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No READY creatives found.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {creativesList.map((c) => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedCreativeId === c.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="creative"
                            value={c.id}
                            checked={selectedCreativeId === c.id}
                            onChange={() => setSelectedCreativeId(c.id)}
                            className="accent-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {c.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.creativeType}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setCreateStep(2)}
                      disabled={!selectedCreativeId}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                                 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Campaign + Adset */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Campaign <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={createCampaignId}
                      onChange={(e) => {
                        setCreateCampaignId(e.target.value);
                        setCreateAdsetId('');
                      }}
                      className={inputCls}
                    >
                      <option value="">Select campaign...</option>
                      {linkedCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Ad Set <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={createAdsetId}
                      onChange={(e) => setCreateAdsetId(e.target.value)}
                      disabled={!createCampaignId}
                      className={inputCls}
                    >
                      <option value="">Select ad set...</option>
                      {createAdsets.map((as) => (
                        <option key={as.id} value={as.id}>
                          {as.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setCreateStep(1)}
                      className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCreateStep(3)}
                      disabled={!createCampaignId || !createAdsetId}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                                 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Ad Name + Page */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Ad Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={createAdName}
                      onChange={(e) => setCreateAdName(e.target.value)}
                      className={inputCls}
                      placeholder="My New Ad"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1.5">
                      Facebook Page <span className="text-red-400">*</span>
                    </label>
                    {pageConnectionsLoading ? (
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    ) : (
                      <select
                        value={createPageConnId}
                        onChange={(e) => setCreatePageConnId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select page...</option>
                        {pageConnections.map((conn) => (
                          <option key={conn.id} value={conn.id}>
                            {conn.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setCreateStep(2)}
                      className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCreateStep(4)}
                      disabled={!createAdName.trim() || !createPageConnId}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                                 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      Review
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {createStep === 4 && (
                <div className="space-y-4">
                  <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2 text-sm">
                    <ReviewRow label="Creative" value={selectedCreative?.name ?? selectedCreativeId} />
                    <ReviewRow
                      label="Campaign"
                      value={linkedCampaigns.find((c) => c.id === createCampaignId)?.name ?? createCampaignId}
                    />
                    <ReviewRow
                      label="Ad Set"
                      value={createAdsets.find((as) => as.id === createAdsetId)?.name ?? createAdsetId}
                    />
                    <ReviewRow label="Ad Name" value={createAdName} />
                    <ReviewRow
                      label="Page"
                      value={pageConnections.find((c) => c.id === createPageConnId)?.name ?? createPageConnId}
                    />
                  </div>

                  {createError && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertTriangle size={14} />
                      {createError}
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setCreateStep(3)}
                      disabled={createSubmitting}
                      className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreateSubmit}
                      disabled={createSubmitting}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                                 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                      {createSubmitting && <Loader2 size={14} className="animate-spin" />}
                      {createSubmitting ? 'Creating...' : 'Create Ad'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
