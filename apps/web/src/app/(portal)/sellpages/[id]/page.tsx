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
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { fmtDate, moneyWhole } from '@/lib/format';
import type { SellpageDetail, UpdateSellpageDto } from '@/types/api';

export default function SellpageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [sp, setSp] = useState<SellpageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode state ──
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSlug, setEditSlug] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // ── Publish state ──
  const [publishing, setPublishing] = useState(false);

  const fetchSellpage = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SellpageDetail>(`/sellpages/${id}`);
      setSp(data);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load sellpage');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSellpage();
  }, [fetchSellpage]);

  // ── Enter edit mode ──
  function startEditing() {
    if (!sp) return;
    setEditSlug(sp.slug);
    setEditTitle(sp.titleOverride ?? '');
    setEditDesc(sp.descriptionOverride ?? '');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  // ── Save edits ──
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!sp || !editSlug.trim()) return;
    setSaving(true);

    try {
      const body: UpdateSellpageDto = {};
      if (editSlug.trim() !== sp.slug) body.slug = editSlug.trim();
      if (editTitle.trim() !== (sp.titleOverride ?? '')) body.titleOverride = editTitle.trim();
      if (editDesc.trim() !== (sp.descriptionOverride ?? '')) body.descriptionOverride = editDesc.trim();

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

  const inputCls =
    'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

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
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
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

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.push('/sellpages')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Sellpages
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">{sp.titleOverride ?? sp.slug}</h1>
        <StatusBadge status={sp.status} />

        <div className="ml-auto flex items-center gap-2">
          {/* Publish / Unpublish */}
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

          {/* Edit toggle */}
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
              onClick={cancelEditing}
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

      {/* ── Edit form (inline) ── */}
      {editing && (
        <form onSubmit={handleSave} className="bg-card border border-primary/20 rounded-xl p-5 mb-6 space-y-4">
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
              Title Override <span className="text-xs text-muted-foreground/60">(optional)</span>
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
              Description Override <span className="text-xs text-muted-foreground/60">(optional)</span>
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
              onClick={cancelEditing}
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

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Domain & URL */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">URL / Domain</h2>
          <p className="text-sm text-foreground mb-1">Slug: <span className="font-mono">/{sp.slug}</span></p>
          <p className="text-sm text-muted-foreground mb-2">Type: {sp.sellpageType}</p>
          <a
            href={sp.urlPreview.startsWith('http') ? sp.urlPreview : `https://${sp.urlPreview}`}
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

      {/* Description */}
      {sp.descriptionOverride && !editing && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Description Override</h2>
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
        <p className="text-xs text-muted-foreground mt-1">Coming soon — creative assignment endpoint not yet available</p>
      </div>
    </div>
  );
}
