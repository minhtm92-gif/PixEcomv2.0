'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  X,
  Save,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Type,
  FileText,
  AlignLeft,
  Layers,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/format';
import type {
  CreativeDetail,
  UpdateCreativeDto,
  CreativeType,
  AssetRole,
  ProductCardItem,
  ProductsListResponse,
} from '@/types/api';

const TYPE_LABELS: Record<string, string> = {
  VIDEO_AD: 'Video Ad',
  IMAGE_AD: 'Image Ad',
  TEXT_ONLY: 'Text Only',
  UGC_BUNDLE: 'UGC Bundle',
};

const ASSET_ROLES: { role: AssetRole; label: string; icon: typeof Film }[] = [
  { role: 'PRIMARY_VIDEO', label: 'Primary Video', icon: Film },
  { role: 'THUMBNAIL', label: 'Thumbnail', icon: ImageIcon },
  { role: 'PRIMARY_TEXT', label: 'Primary Text', icon: Type },
  { role: 'HEADLINE', label: 'Headline', icon: FileText },
  { role: 'DESCRIPTION', label: 'Description', icon: AlignLeft },
  { role: 'EXTRA', label: 'Extra', icon: Layers },
];

export default function CreativeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [creative, setCreative] = useState<CreativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode ──
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CreativeType>('VIDEO_AD');
  const [editProductId, setEditProductId] = useState('');

  // ── Products for edit dropdown ──
  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // ── Validate state ──
  const [validating, setValidating] = useState(false);

  // ── Preview state ──
  const [previewing, setPreviewing] = useState(false);

  const fetchCreative = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<CreativeDetail>(`/creatives/${id}`);
      setCreative(data);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load creative');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCreative();
  }, [fetchCreative]);

  // ── Lazy-load products on first edit ──
  async function loadProducts() {
    if (productsLoaded) return;
    try {
      const res = await apiGet<ProductsListResponse>('/products?limit=100');
      setProducts(res.data);
      setProductsLoaded(true);
    } catch (err) {
      toastApiError(err as ApiError);
    }
  }

  function startEditing() {
    if (!creative) return;
    setEditName(creative.name);
    setEditType(creative.creativeType);
    setEditProductId(creative.productId ?? '');
    setEditing(true);
    loadProducts();
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!creative || !editName.trim()) return;
    setSaving(true);

    try {
      const body: UpdateCreativeDto = {};
      if (editName.trim() !== creative.name) body.name = editName.trim();
      if (editType !== creative.creativeType) body.creativeType = editType;
      const newProd = editProductId || undefined;
      const oldProd = creative.productId ?? undefined;
      if (newProd !== oldProd) body.productId = newProd;

      const updated = await apiPatch<CreativeDetail>(`/creatives/${creative.id}`, body);
      setCreative(updated);
      setEditing(false);
      addToast('Creative updated', 'success');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  // ── Validate (DRAFT → READY) ──
  async function handleValidate() {
    if (!creative) return;
    setValidating(true);
    try {
      await apiPost(`/creatives/${creative.id}/validate`);
      addToast('Creative validated — status is now READY', 'success');
      await fetchCreative();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setValidating(false);
    }
  }

  // ── Preview ──
  async function handlePreview() {
    if (!creative) return;
    setPreviewing(true);
    try {
      const data = await apiGet<{ url?: string; html?: string }>(`/creatives/${creative.id}/render`);
      if (data.url) {
        window.open(data.url, '_blank');
      } else if (data.html) {
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        addToast('Preview not available', 'warning');
      }
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setPreviewing(false);
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

  if (error || !creative) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Creative not found'}
        </div>
      </div>
    );
  }

  const isDraft = creative.status.toUpperCase() === 'DRAFT';

  // Build asset map for quick lookup
  const assetMap = new Map(creative.assets.map((a) => [a.role, a]));

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.push('/creatives')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Creatives
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">{creative.name}</h1>
        <StatusBadge status={creative.status} />
        <span className="text-xs text-muted-foreground">{TYPE_LABELS[creative.creativeType] ?? creative.creativeType}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Validate */}
          {isDraft && (
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium
                         hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Validate
            </button>
          )}

          {/* Preview */}
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                       hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {previewing ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Preview
          </button>

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
          <h2 className="text-sm font-semibold text-foreground mb-2">Edit Creative</h2>

          <div>
            <label htmlFor="edit-name" className="block text-sm text-muted-foreground mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className={inputCls}
              placeholder="Creative name"
            />
          </div>

          <div>
            <label htmlFor="edit-type" className="block text-sm text-muted-foreground mb-1.5">
              Type
            </label>
            <select
              id="edit-type"
              value={editType}
              onChange={(e) => setEditType(e.target.value as CreativeType)}
              className={inputCls}
            >
              <option value="VIDEO_AD">Video Ad</option>
              <option value="IMAGE_AD">Image Ad</option>
              <option value="TEXT_ONLY">Text Only</option>
              <option value="UGC_BUNDLE">UGC Bundle</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-product" className="block text-sm text-muted-foreground mb-1.5">
              Product <span className="text-xs text-muted-foreground/60">(optional)</span>
            </label>
            {!productsLoaded ? (
              <div className="h-10 bg-muted rounded animate-pulse" />
            ) : (
              <select
                id="edit-product"
                value={editProductId}
                onChange={(e) => setEditProductId(e.target.value)}
                className={inputCls}
              >
                <option value="">No product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            )}
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
              disabled={saving || !editName.trim()}
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
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Details</h2>
          <div className="space-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Type: </span>
              <span className="text-foreground">{TYPE_LABELS[creative.creativeType] ?? creative.creativeType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status: </span>
              <StatusBadge status={creative.status} />
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="text-foreground">{fmtDate(creative.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated: </span>
              <span className="text-foreground">{fmtDate(creative.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Linked Product</h2>
          {creative.product ? (
            <div>
              <p className="text-sm font-medium text-foreground">{creative.product.name}</p>
              <p className="text-xs text-muted-foreground mt-1">ID: {creative.product.id}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No product linked</p>
          )}
        </div>
      </div>

      {/* ── Asset Slots Grid ── */}
      <h2 className="text-sm font-medium text-foreground mb-3">Asset Slots</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {ASSET_ROLES.map(({ role, label, icon: Icon }) => {
          const asset = assetMap.get(role);
          return (
            <div
              key={role}
              className={`bg-card border rounded-xl p-4 ${
                asset ? 'border-primary/30' : 'border-border border-dashed'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className={asset ? 'text-primary' : 'text-muted-foreground'} />
                <h3 className="text-sm font-medium text-foreground">{label}</h3>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">{role}</span>
              </div>

              {asset ? (
                <div className="space-y-1">
                  <p className="text-sm text-foreground truncate">{asset.asset.filename}</p>
                  <p className="text-xs text-muted-foreground">{asset.asset.mimeType}</p>
                  <a
                    href={asset.asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary text-xs hover:underline mt-1"
                  >
                    <ExternalLink size={10} /> View asset
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <p className="text-sm text-muted-foreground">Empty</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata */}
      {creative.metadata && Object.keys(creative.metadata).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Metadata</h2>
          <pre className="text-xs text-foreground font-mono bg-muted/50 rounded p-3 overflow-x-auto">
            {JSON.stringify(creative.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
