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
  ImageIcon,
  Type,
  FileText,
  AlignLeft,
  UploadCloud,
  Trash2,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiDelete, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { AssetUploader } from '@/components/AssetUploader';
import { fmtDate } from '@/lib/format';
import type {
  CreativeDetail,
  UpdateCreativeDto,
  CreativeType,
  AssetRole,
  ProductCardItem,
  ProductsListResponse,
} from '@/types/api';

// ── Type config ──
const TYPE_CONFIG: Record<string, {
  label: string;
  icon: typeof Film;
  mode: 'video' | 'image' | 'text';
  assetRole?: AssetRole;
  placeholder?: string;
}> = {
  VIDEO:       { label: 'Video', icon: Film, mode: 'video', assetRole: 'PRIMARY_VIDEO' },
  THUMBNAIL:   { label: 'Thumbnail', icon: ImageIcon, mode: 'image', assetRole: 'THUMBNAIL' },
  ADTEXT:      { label: 'Adtext', icon: Type, mode: 'text', placeholder: 'Enter your ad text...' },
  HEADLINE:    { label: 'Headline', icon: FileText, mode: 'text', placeholder: 'Enter headline...' },
  DESCRIPTION: { label: 'Description', icon: AlignLeft, mode: 'text', placeholder: 'Enter description...' },
  // Legacy
  VIDEO_AD:    { label: 'Video Ad', icon: Film, mode: 'video', assetRole: 'PRIMARY_VIDEO' },
  IMAGE_AD:    { label: 'Image Ad', icon: ImageIcon, mode: 'image', assetRole: 'THUMBNAIL' },
  TEXT_ONLY:   { label: 'Text Only', icon: Type, mode: 'text', placeholder: 'Enter text...' },
  UGC_BUNDLE:  { label: 'UGC Bundle', icon: Film, mode: 'video', assetRole: 'PRIMARY_VIDEO' },
};

// ── Modal shell ──
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm remove dialog ──
function ConfirmRemoveDialog({
  label,
  onConfirm,
  onCancel,
  loading,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-400 shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">Remove Asset</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Remove the <span className="text-foreground font-medium">{label}</span> asset from this creative?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium
                       hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
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
  const [editProductId, setEditProductId] = useState('');

  // ── Text content for text-type creatives ──
  const [textContent, setTextContent] = useState('');
  const [savingText, setSavingText] = useState(false);

  // ── Products for edit dropdown ──
  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // ── Validate state ──
  const [validating, setValidating] = useState(false);

  // ── Upload modal ──
  const [uploadOpen, setUploadOpen] = useState(false);

  // ── Remove confirm ──
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  // ── Assigning asset (POST after upload) ──
  const [assigning, setAssigning] = useState(false);

  const fetchCreative = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<CreativeDetail>(`/creatives/${id}`);
      setCreative(data);
      // Init text content from metadata
      const meta = data.metadata as Record<string, unknown> | null;
      setTextContent((meta?.content as string) ?? '');
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

  // Get type config
  const typeKey = creative?.creativeType ?? 'VIDEO';
  const config = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG['VIDEO'];
  const TypeIcon = config.icon;
  const isTextType = config.mode === 'text';
  const assetRole = config.assetRole;

  // Get attached asset (for upload types)
  const attachedAsset = assetRole
    ? creative?.assets.find((a) => a.role === assetRole)
    : null;

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
      const newProd = editProductId || undefined;
      const oldProd = creative.productId ?? undefined;
      if (newProd !== oldProd) body.productId = newProd;

      const updated = await apiGet<CreativeDetail>(`/creatives/${creative.id}`);
      await apiPatch<CreativeDetail>(`/creatives/${creative.id}`, body);
      addToast('Creative updated', 'success');
      setEditing(false);
      await fetchCreative();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  // ── Save text content ──
  async function handleSaveText() {
    if (!creative) return;
    setSavingText(true);
    try {
      await apiPatch<CreativeDetail>(`/creatives/${creative.id}`, {
        metadata: { content: textContent },
      });
      addToast('Content saved', 'success');
      await fetchCreative();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSavingText(false);
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

  // ── Upload success → assign slot ──
  async function handleUploadSuccess(assetId: string) {
    if (!creative || !assetRole) return;
    setUploadOpen(false);
    setAssigning(true);
    try {
      await apiPost(`/creatives/${creative.id}/assets`, {
        assetId,
        role: assetRole,
      });
      addToast('Asset uploaded and assigned', 'success');
      await fetchCreative();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setAssigning(false);
    }
  }

  // ── Remove asset slot ──
  async function handleRemoveConfirm() {
    if (!creative || !assetRole) return;
    setRemoving(true);
    try {
      await apiDelete(`/creatives/${creative.id}/assets/${assetRole}`);
      addToast('Asset removed', 'success');
      setRemoveOpen(false);
      await fetchCreative();
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setRemoving(false);
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

  // Check if text content has changed from saved version
  const savedContent = ((creative.metadata as Record<string, unknown> | null)?.content as string) ?? '';
  const textChanged = textContent !== savedContent;

  return (
    <div className="p-6 max-w-3xl">
      <button onClick={() => router.push('/creatives')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Creatives
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-2 rounded-lg ${isDraft ? 'bg-muted' : 'bg-primary/10'}`}>
          <TypeIcon size={20} className={isDraft ? 'text-muted-foreground' : 'text-primary'} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground truncate">{creative.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={creative.status} />
            <span className="text-xs text-muted-foreground">{config.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {assigning && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Assigning…
            </span>
          )}

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

      {/* ── Edit form (name only, type is fixed after creation) ── */}
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

      {/* ── Content Section — type-specific ── */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <TypeIcon size={16} className="text-primary" />
          {config.label} Content
        </h2>

        {isTextType ? (
          /* ── Text input for ADTEXT / HEADLINE / DESCRIPTION ── */
          <div className="space-y-3">
            {typeKey === 'HEADLINE' ? (
              <input
                type="text"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder={config.placeholder}
                maxLength={255}
                className={inputCls}
              />
            ) : (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder={config.placeholder}
                rows={typeKey === 'DESCRIPTION' ? 4 : 6}
                className={`${inputCls} resize-none`}
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {textContent.length} character{textContent.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleSaveText}
                disabled={savingText || !textChanged}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {savingText ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {savingText ? 'Saving...' : 'Save Content'}
              </button>
            </div>
          </div>
        ) : attachedAsset ? (
          /* ── Asset preview (VIDEO or THUMBNAIL) ── */
          <div className="space-y-3">
            {attachedAsset.asset.mimeType?.startsWith('video/') ? (
              <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 bg-muted/50 rounded-xl border border-border">
                <Play size={32} className="text-muted-foreground" />
                <a
                  href={attachedAsset.asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={12} /> View video
                </a>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={attachedAsset.asset.url}
                alt={attachedAsset.asset.filename}
                className="w-full max-h-64 object-contain rounded-xl border border-border bg-muted/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}

            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{attachedAsset.asset.filename}</p>
                <p className="text-xs text-muted-foreground">{attachedAsset.asset.mimeType}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setUploadOpen(true)}
                  disabled={assigning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs
                             hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <UploadCloud size={13} /> Replace
                </button>
                <button
                  onClick={() => setRemoveOpen(true)}
                  disabled={assigning || removing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs
                             hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Empty upload area ── */
          <div className="flex flex-col items-center justify-center py-10 gap-4 border-2 border-dashed border-border rounded-xl">
            <UploadCloud size={36} className="text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-foreground font-medium">
                No {config.label.toLowerCase()} uploaded yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {config.mode === 'video'
                  ? 'Upload a video file (MP4, WebM)'
                  : 'Upload an image file (JPEG, PNG, GIF, WebP)'}
              </p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              disabled={assigning}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <UploadCloud size={14} />
              Upload {config.label}
            </button>
          </div>
        )}
      </div>

      {/* ── Details card ── */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Type: </span>
            <span className="text-foreground">{config.label}</span>
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

      {/* ── Assign to Product (separate at bottom) ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Assign to Product</h2>
        {creative.product ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{creative.product.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">ID: {creative.product.id}</p>
            </div>
            <button
              onClick={startEditing}
              className="text-xs text-primary hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No product linked</p>
            <button
              onClick={startEditing}
              className="text-xs text-primary hover:underline"
            >
              Assign
            </button>
          </div>
        )}

        {/* Product selector in edit mode */}
        {editing && (
          <div className="mt-3 pt-3 border-t border-border">
            <label htmlFor="edit-product" className="block text-xs text-muted-foreground mb-1.5">
              Select Product
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
        )}
      </div>

      {/* ── Upload modal ── */}
      {uploadOpen && assetRole && (
        <ModalShell
          title={`Upload ${config.label}`}
          onClose={() => setUploadOpen(false)}
        >
          <AssetUploader
            onSuccess={handleUploadSuccess}
            onClose={() => setUploadOpen(false)}
            accept={config.mode === 'video' ? 'video' : 'image'}
          />
        </ModalShell>
      )}

      {/* ── Remove confirm dialog ── */}
      {removeOpen && (
        <ConfirmRemoveDialog
          label={config.label}
          onConfirm={handleRemoveConfirm}
          onCancel={() => setRemoveOpen(false)}
          loading={removing}
        />
      )}
    </div>
  );
}
