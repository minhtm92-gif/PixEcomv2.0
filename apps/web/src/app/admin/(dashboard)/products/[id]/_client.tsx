'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Save,
  Plus,
  Trash2,
  Upload,
  X,
  Wand2,
  GripVertical,
  Edit3,
  ImageIcon,
  Check,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { moneyDecimal, moneyWhole, safeDecimal, num, fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAdminApi } from '@/hooks/useAdminApi';
import { apiPost, apiPatch, apiDelete } from '@/lib/apiClient';
import { useToastStore } from '@/stores/toastStore';
import dynamic from 'next/dynamic';

const TipTapEditor = dynamic(() => import('@/components/TipTapEditor'), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────

interface VariantData {
  id: string;
  name: string;
  sku: string | null;
  priceOverride: string | number | null;
  compareAtPrice: string | number | null;
  costPrice: string | number | null;
  fulfillmentCost: string | number | null;
  image: string | null;
  options: Record<string, string>;
  stockQuantity: number;
  isActive: boolean;
  position: number;
}

interface LabelJoin {
  productId: string;
  labelId: string;
  label: { id: string; name: string; slug: string };
}

interface PricingRuleData {
  id: string;
  suggestedRetail: string | number;
  sellerTakePercent: string | number;
  sellerTakeFixed: string | number | null;
  holdPercent: string | number | null;
  holdDurationDays: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
}

interface OptionDef {
  name: string;
  type: string;
  values: string[];
}

interface QuantityCostEntry {
  qty: number;
  cost: number;
  percent: number;
}

interface ProductDetail {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  basePrice: string | number;
  compareAtPrice: string | number | null;
  costPrice: string | number | null;
  currency: string;
  sku: string | null;
  description: string | null;
  status: string;
  tags: string[];
  images: string[];
  optionDefinitions: OptionDef[];
  quantityCosts: QuantityCostEntry[];
  allowOutOfStockPurchase: boolean;
  rating: string | number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  variants: VariantData[];
  labels: LabelJoin[];
  pricingRules: PricingRuleData[];
  _count: { sellpages: number; orderItems: number };
}

interface LabelItem {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

// ── Sortable Image Item ─────────────────────────────────────────────────────

function SortableImageItem({ url, idx, onRemove }: { url: string; idx: number; onRemove: (i: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
      <img src={url} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
      <div {...attributes} {...listeners} className="absolute top-1 right-1 p-1 bg-black/40 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={14} className="text-white" />
      </div>
      <button
        onClick={() => onRemove(idx)}
        className="absolute bottom-1 right-1 p-1 bg-red-500/80 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
      >
        <X size={14} />
      </button>
      {idx === 0 && (
        <span className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">Main</span>
      )}
    </div>
  );
}

function SortableImageGallery({
  images,
  onReorder,
  onRemove,
  children,
}: {
  images: string[];
  onReorder: (newImages: string[]) => void;
  onRemove: (idx: number) => void;
  children?: React.ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = images.indexOf(active.id as string);
      const newIdx = images.indexOf(over.id as string);
      if (oldIdx !== -1 && newIdx !== -1) {
        onReorder(arrayMove(images, oldIdx, newIdx));
      }
    }
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">Images ({images.length})</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
            {images.map((url, idx) => (
              <SortableImageItem key={url} url={url} idx={idx} onRemove={onRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {children}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

const smallInputCls =
  'w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50';

const TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Description', value: 'description' },
  { label: 'Variants', value: 'variants' },
  { label: 'Cost / Quantity', value: 'cost' },
  { label: 'Labels', value: 'labels' },
  { label: 'Pricing Rules', value: 'pricing' },
  { label: 'Stats', value: 'stats' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function ProductDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.add);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);

  const { data: product, loading, error, refetch } = useAdminApi<ProductDetail>(
    `/admin/products/${id}`,
  );
  const { data: allLabels, refetch: refetchLabels } = useAdminApi<LabelItem[]>(
    '/admin/products/labels',
  );

  // ── Save helper ──
  const saveProduct = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      try {
        await apiPatch(`/admin/products/${id}`, patch);
        toast('Saved', 'success');
        refetch();
      } catch {
        toast('Save failed', 'error');
      } finally {
        setSaving(false);
      }
    },
    [id, toast, refetch],
  );

  if (loading) {
    return (
      <div className="p-6 max-w-6xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-8 bg-muted rounded w-96" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/admin/products')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Products
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Product not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      <button
        onClick={() => router.push('/admin/products')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Products
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Package size={20} className="text-amber-400" />
          {product.name}
        </h1>
        <StatusBadge status={product.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab product={product} saveProduct={saveProduct} saving={saving} refetch={refetch} />
      )}
      {tab === 'description' && (
        <DescriptionTab product={product} saveProduct={saveProduct} saving={saving} />
      )}
      {tab === 'variants' && (
        <VariantsTab product={product} refetch={refetch} />
      )}
      {tab === 'cost' && (
        <CostQuantityTab product={product} saveProduct={saveProduct} saving={saving} />
      )}
      {tab === 'labels' && (
        <LabelsTab product={product} allLabels={allLabels ?? []} refetch={refetch} refetchLabels={refetchLabels} />
      )}
      {tab === 'pricing' && (
        <PricingRulesTab product={product} refetch={refetch} />
      )}
      {tab === 'stats' && <StatsTab product={product} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({
  product,
  saveProduct,
  saving,
  refetch,
}: {
  product: ProductDetail;
  saveProduct: (p: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  refetch: () => void;
}) {
  const toast = useToastStore((s) => s.add);
  const [editName, setEditName] = useState(product.name);
  const [editStatus, setEditStatus] = useState(product.status);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images: string[] = (product.images as string[]) ?? [];

  const handleSaveInfo = () => {
    saveProduct({ name: editName, status: editStatus });
  };

  const handleImageUpload = async (files: FileList) => {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const { uploadUrl, publicUrl } = await apiPost<{ uploadUrl: string; publicUrl: string }>(
          '/admin/products/upload',
          { filename: file.name, contentType: file.type },
        );
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        uploaded.push(publicUrl);
      }
      const newImages = [...images, ...uploaded];
      await apiPatch(`/admin/products/${product.id}`, { images: newImages });
      toast(`${uploaded.length} image(s) uploaded`, 'success');
      refetch();
    } catch {
      toast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (idx: number) => {
    const newImages = images.filter((_, i) => i !== idx);
    await apiPatch(`/admin/products/${product.id}`, { images: newImages });
    toast('Image removed', 'success');
    refetch();
  };

  const handleMoveImage = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= images.length) return;
    const newImages = [...images];
    const [moved] = newImages.splice(fromIdx, 1);
    newImages.splice(toIdx, 0, moved);
    await apiPatch(`/admin/products/${product.id}`, { images: newImages });
    refetch();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Product Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Product Info</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Product Code</label>
            <p className="text-sm text-foreground font-mono">{product.productCode}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">SKU</label>
            <p className="text-sm text-foreground font-mono">{product.sku ?? '—'}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <select className={inputCls} value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tags</label>
            <div className="flex gap-2 flex-wrap">
              {((product.tags as string[]) ?? []).map((tag) => (
                <span key={tag} className="bg-muted rounded-full px-3 py-1 text-xs text-foreground font-medium">
                  {tag}
                </span>
              ))}
              {(product.tags?.length ?? 0) === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="allowOos"
              checked={product.allowOutOfStockPurchase}
              onChange={async (e) => {
                try {
                  await apiPatch(`/admin/products/${product.id}`, { allowOutOfStockPurchase: e.target.checked });
                  toast(e.target.checked ? 'Out-of-stock purchase enabled' : 'Out-of-stock purchase disabled', 'success');
                  refetch();
                } catch { toast('Failed to update', 'error'); }
              }}
              className="h-4 w-4 rounded border-border text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="allowOos" className="text-xs text-foreground cursor-pointer">
              Allow purchase when out of stock
            </label>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Created</label>
            <p className="text-sm text-foreground">{fmtDate(product.createdAt)}</p>
          </div>
          <button
            onClick={handleSaveInfo}
            disabled={saving}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <Save size={14} /> Save Info
          </button>
        </div>
      </div>

      {/* Pricing + Images */}
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Pricing</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Base Price</label>
              <p className="text-sm font-mono text-foreground">{moneyDecimal(product.basePrice)}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Compare At</label>
              <p className="text-sm font-mono text-muted-foreground line-through">
                {product.compareAtPrice ? moneyDecimal(product.compareAtPrice) : '—'}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cost Price</label>
              <p className="text-sm font-mono text-foreground">
                {product.costPrice ? moneyDecimal(product.costPrice) : '—'}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Margin</label>
              <p className="text-sm font-mono text-green-400">
                {product.costPrice
                  ? moneyWhole(safeDecimal(product.basePrice) - safeDecimal(product.costPrice))
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        <SortableImageGallery
          images={images}
          onReorder={async (newImages) => {
            await apiPatch(`/admin/products/${product.id}`, { images: newImages });
            refetch();
          }}
          onRemove={handleRemoveImage}
        />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-amber-500/50 transition-colors disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Add Images'}
          </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESCRIPTION TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DescriptionTab({
  product,
  saveProduct,
  saving,
}: {
  product: ProductDetail;
  saveProduct: (p: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [html, setHtml] = useState(product.description ?? '');

  return (
    <div className="space-y-4">
      <TipTapEditor value={html} onChange={setHtml} />
      <button
        onClick={() => saveProduct({ description: html })}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        <Save size={14} /> {saving ? 'Saving...' : 'Save Description'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function VariantsTab({
  product,
  refetch,
}: {
  product: ProductDetail;
  refetch: () => void;
}) {
  const toast = useToastStore((s) => s.add);
  const [optionDefs, setOptionDefs] = useState<OptionDef[]>(
    () => (product.optionDefinitions as OptionDef[]) ?? [],
  );
  const [generating, setGenerating] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editingVariants, setEditingVariants] = useState<Record<string, Partial<VariantData>>>({});

  const addOption = () => {
    setOptionDefs([...optionDefs, { name: '', type: 'default', values: [] }]);
  };

  const removeOption = (idx: number) => {
    setOptionDefs(optionDefs.filter((_, i) => i !== idx));
  };

  const updateOptionName = (idx: number, name: string) => {
    const updated = [...optionDefs];
    updated[idx] = { ...updated[idx], name };
    setOptionDefs(updated);
  };

  const addOptionValue = (idx: number, val: string) => {
    if (!val.trim()) return;
    const updated = [...optionDefs];
    if (!updated[idx].values.includes(val.trim())) {
      updated[idx] = { ...updated[idx], values: [...updated[idx].values, val.trim()] };
      setOptionDefs(updated);
    }
  };

  const removeOptionValue = (optIdx: number, valIdx: number) => {
    const updated = [...optionDefs];
    updated[optIdx] = {
      ...updated[optIdx],
      values: updated[optIdx].values.filter((_, i) => i !== valIdx),
    };
    setOptionDefs(updated);
  };

  const saveOptionDefs = async () => {
    try {
      await apiPatch(`/admin/products/${product.id}`, { optionDefinitions: optionDefs });
      toast('Options saved', 'success');
      refetch();
    } catch {
      toast('Save failed', 'error');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await apiPatch(`/admin/products/${product.id}`, { optionDefinitions: optionDefs });
      const result = await apiPost<{ created: number }>(`/admin/products/${product.id}/generate-variants`);
      toast(`Generated ${result.created} variant(s)`, 'success');
      refetch();
    } catch {
      toast('Generate failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      await apiDelete(`/admin/products/${product.id}/variants/${variantId}`);
      toast('Variant deleted', 'success');
      refetch();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  const updateEditField = (variantId: string, field: string, value: unknown) => {
    setEditingVariants((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], [field]: value },
    }));
  };

  const handleBulkSave = async () => {
    const entries = Object.entries(editingVariants);
    if (entries.length === 0) return;
    setBulkSaving(true);
    try {
      const variants = entries.map(([vid, fields]) => ({
        id: vid,
        ...fields,
        priceOverride: fields.priceOverride !== undefined ? Number(fields.priceOverride) : undefined,
        compareAtPrice: fields.compareAtPrice !== undefined ? Number(fields.compareAtPrice) : undefined,
        costPrice: fields.costPrice !== undefined ? Number(fields.costPrice) : undefined,
        fulfillmentCost: fields.fulfillmentCost !== undefined ? Number(fields.fulfillmentCost) : undefined,
      }));
      await apiPatch(`/admin/products/${product.id}/variants/bulk`, { variants });
      toast('Variants saved', 'success');
      setEditingVariants({});
      refetch();
    } catch {
      toast('Bulk save failed', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  // ── Select Matrix state ──
  const [selectedChips, setSelectedChips] = useState<Record<string, Set<string>>>({});
  const [bulkDropdownOpen, setBulkDropdownOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState<'field' | 'image' | null>(null);
  const [bulkFields, setBulkFields] = useState({ price: '', comparePrice: '', costPrice: '', fulfillmentCost: '' });
  const [bulkFieldEnabled, setBulkFieldEnabled] = useState({ price: false, comparePrice: false, costPrice: false, fulfillmentCost: false });

  // Filter variants based on selected chips
  const filteredVariants = useMemo(() => {
    const entries = Object.entries(selectedChips);
    const activeFilters = entries.filter(([, vals]) => vals.size > 0);
    if (activeFilters.length === 0) return product.variants;
    return product.variants.filter((v) => {
      const opts = v.options ?? {};
      return activeFilters.every(([optName, vals]) => {
        const variantVal = opts[optName];
        return variantVal && vals.has(variantVal);
      });
    });
  }, [product.variants, selectedChips]);

  const toggleChip = (optName: string, val: string) => {
    setSelectedChips((prev) => {
      const next = { ...prev };
      const set = new Set(next[optName] ?? []);
      if (set.has(val)) set.delete(val); else set.add(val);
      next[optName] = set;
      return next;
    });
  };

  const selectAll = () => {
    const all: Record<string, Set<string>> = {};
    optionDefs.forEach((o) => { all[o.name] = new Set(o.values); });
    setSelectedChips(all);
  };

  const selectNone = () => setSelectedChips({});

  const selectedCount = filteredVariants.length;

  const handleBulkApply = async () => {
    const ids = filteredVariants.map((v) => v.id);
    const variants = ids.map((id) => {
      const upd: Record<string, unknown> = { id };
      if (bulkFieldEnabled.price && bulkFields.price) upd.priceOverride = Number(bulkFields.price);
      if (bulkFieldEnabled.comparePrice && bulkFields.comparePrice) upd.compareAtPrice = Number(bulkFields.comparePrice);
      if (bulkFieldEnabled.costPrice && bulkFields.costPrice) upd.costPrice = Number(bulkFields.costPrice);
      if (bulkFieldEnabled.fulfillmentCost && bulkFields.fulfillmentCost) upd.fulfillmentCost = Number(bulkFields.fulfillmentCost);
      return upd;
    });
    try {
      await apiPatch(`/admin/products/${product.id}/variants/bulk`, { variants });
      toast(`Updated ${ids.length} variant(s)`, 'success');
      setBulkModalOpen(null);
      setBulkFields({ price: '', comparePrice: '', costPrice: '', fulfillmentCost: '' });
      setBulkFieldEnabled({ price: false, comparePrice: false, costPrice: false, fulfillmentCost: false });
      refetch();
    } catch {
      toast('Bulk update failed', 'error');
    }
  };

  const getVal = (v: VariantData, field: keyof VariantData) => {
    const edit = editingVariants[v.id];
    if (edit && field in edit) return edit[field as keyof typeof edit];
    return v[field];
  };

  return (
    <div className="space-y-6">
      {/* Option Builder */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Option Builder</h2>
        <div className="space-y-3">
          {optionDefs.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-40 shrink-0">
                <label className="text-xs text-muted-foreground mb-1 block">Option Name</label>
                <input
                  className={smallInputCls}
                  value={opt.name}
                  onChange={(e) => updateOptionName(idx, e.target.value)}
                  placeholder="e.g. Color, Size"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs text-muted-foreground mb-1 block">Values</label>
                <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] w-full bg-zinc-800/60 border border-border rounded-lg px-2 py-1.5">
                  {opt.values.map((v, vIdx) => (
                    <span key={vIdx} className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 rounded-full px-2.5 py-0.5 text-xs">
                      {v}
                      <button onClick={() => removeOptionValue(idx, vIdx)} className="text-amber-400/60 hover:text-red-400">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                    placeholder={opt.values.length === 0 ? 'Type and press Enter or comma' : 'Add more...'}
                    onKeyDown={(e) => {
                      const input = e.target as HTMLInputElement;
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const raw = input.value.replace(/,/g, '');
                        if (raw.trim()) {
                          addOptionValue(idx, raw.trim());
                          input.value = '';
                        }
                      }
                      if (e.key === 'Backspace' && input.value === '' && opt.values.length > 0) {
                        removeOptionValue(idx, opt.values.length - 1);
                      }
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value.replace(/,/g, '').trim();
                      if (raw) {
                        addOptionValue(idx, raw);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              <button onClick={() => removeOption(idx)} className="shrink-0 text-muted-foreground hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={addOption} className="text-sm text-amber-400 hover:text-amber-300">
            + Add another option
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={saveOptionDefs}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
          >
            <Save size={14} /> Save Options
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || optionDefs.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <Wand2 size={14} /> {generating ? 'Generating...' : 'Generate Variants'}
          </button>
        </div>
      </div>

      {/* Select Matrix */}
      {optionDefs.length > 0 && product.variants.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Select</h2>
            <button onClick={selectAll} className="text-xs text-amber-400 hover:text-amber-300">All</button>
            <button onClick={selectNone} className="text-xs text-red-400 hover:text-red-300">None</button>
          </div>
          {optionDefs.map((opt) => (
            <div key={opt.name} className="flex flex-wrap gap-2 mb-2">
              {opt.values.map((val) => {
                const active = selectedChips[opt.name]?.has(val);
                return (
                  <button
                    key={val}
                    onClick={() => toggleChip(opt.name, val)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-sm transition-colors',
                      active
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-muted/30 text-foreground border-border hover:border-amber-500/50',
                    )}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          ))}
          {selectedCount > 0 && selectedCount < product.variants.length && (
            <div className="mt-3 flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setBulkDropdownOpen(!bulkDropdownOpen)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 border border-border"
                >
                  <Edit3 size={14} /> Edit {selectedCount} selected
                </button>
                {bulkDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[140px]">
                    <button
                      onClick={() => { setBulkDropdownOpen(false); setBulkModalOpen('image'); }}
                      className="block w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors rounded-t-lg"
                    >
                      Choose Image
                    </button>
                    <button
                      onClick={() => { setBulkDropdownOpen(false); setBulkModalOpen('field'); }}
                      className="block w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors rounded-b-lg"
                    >
                      Edit Field
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk Edit Field Modal */}
          {bulkModalOpen === 'field' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBulkModalOpen(null)}>
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{selectedCount} variant(s) to edit:</h3>
                  <button onClick={() => setBulkModalOpen(null)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto">
                  {filteredVariants.map((v) => (
                    <span key={v.id} className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{v.name}</span>
                  ))}
                </div>
                <div className="space-y-3">
                  {([
                    ['price', 'Price', 'priceOverride'],
                    ['comparePrice', 'Compare Price', 'compareAtPrice'],
                    ['costPrice', 'Product Cost', 'costPrice'],
                    ['fulfillmentCost', 'Fulfillment Cost', 'fulfillmentCost'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="w-36 text-sm text-muted-foreground">{label}</label>
                      <input
                        type="number"
                        step="0.01"
                        className={smallInputCls + ' w-32'}
                        value={bulkFields[key]}
                        onChange={(e) => setBulkFields((p) => ({ ...p, [key]: e.target.value }))}
                        disabled={!bulkFieldEnabled[key]}
                      />
                      <button
                        onClick={() => setBulkFieldEnabled((p) => ({ ...p, [key]: !p[key] }))}
                        className={cn(
                          'text-xs px-2 py-1 rounded',
                          bulkFieldEnabled[key] ? 'text-amber-400 bg-amber-500/20' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {bulkFieldEnabled[key] ? <Check size={14} /> : 'Edit'}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-5">
                  <button
                    onClick={handleBulkApply}
                    disabled={!Object.values(bulkFieldEnabled).some(Boolean)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    <Save size={14} /> Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Choose Image Modal */}
          {bulkModalOpen === 'image' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBulkModalOpen(null)}>
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Choose image for {selectedCount} variant(s)</h3>
                  <button onClick={() => setBulkModalOpen(null)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>
                {product.images.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No product images available. Upload images in the Overview tab first.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {product.images.map((url) => (
                      <button
                        key={url}
                        onClick={async () => {
                          const ids = filteredVariants.map((v) => v.id);
                          const variants = ids.map((id) => ({ id, image: url }));
                          try {
                            await apiPatch(`/admin/products/${product.id}/variants/bulk`, { variants });
                            toast(`Image set for ${ids.length} variant(s)`, 'success');
                            setBulkModalOpen(null);
                            refetch();
                          } catch {
                            toast('Failed to set image', 'error');
                          }
                        }}
                        className="aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-amber-500 transition-colors"
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variant Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Variants ({filteredVariants.length}{filteredVariants.length !== product.variants.length ? ` / ${product.variants.length}` : ''})
          </h2>
          {Object.keys(editingVariants).length > 0 && (
            <button
              onClick={handleBulkSave}
              disabled={bulkSaving}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <Save size={14} /> {bulkSaving ? 'Saving...' : `Save Changes (${Object.keys(editingVariants).length})`}
            </button>
          )}
        </div>

        {filteredVariants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {product.variants.length === 0
              ? 'No variants yet. Use the Option Builder above to define options, then click Generate Variants.'
              : 'No variants match the selected filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-8">Img</th>
                  <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground uppercase">Name</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-24">Price</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-24">Compare</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-24">Cost</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-28">Fulfillment</th>
                  <th className="text-left px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-28">SKU</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-muted-foreground uppercase w-16">Stock</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map((v) => (
                  <tr key={v.id} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-2">
                      {v.image ? (
                        <img src={v.image} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded border border-border" />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls}
                        value={String(getVal(v, 'name') ?? v.name)}
                        onChange={(e) => updateEditField(v.id, 'name', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls + ' text-right'}
                        type="number"
                        step="0.01"
                        value={String(getVal(v, 'priceOverride') ?? (safeDecimal(v.priceOverride) || ''))}
                        onChange={(e) => updateEditField(v.id, 'priceOverride', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls + ' text-right'}
                        type="number"
                        step="0.01"
                        value={String(getVal(v, 'compareAtPrice') ?? (safeDecimal(v.compareAtPrice) || ''))}
                        onChange={(e) => updateEditField(v.id, 'compareAtPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls + ' text-right'}
                        type="number"
                        step="0.01"
                        value={String(getVal(v, 'costPrice') ?? (safeDecimal(v.costPrice) || ''))}
                        onChange={(e) => updateEditField(v.id, 'costPrice', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls + ' text-right'}
                        type="number"
                        step="0.01"
                        value={String(getVal(v, 'fulfillmentCost') ?? (safeDecimal(v.fulfillmentCost) || ''))}
                        onChange={(e) => updateEditField(v.id, 'fulfillmentCost', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls}
                        value={String(getVal(v, 'sku') ?? v.sku ?? '')}
                        onChange={(e) => updateEditField(v.id, 'sku', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={smallInputCls + ' text-right w-16'}
                        type="number"
                        value={String(getVal(v, 'stockQuantity') ?? v.stockQuantity)}
                        onChange={(e) => updateEditField(v.id, 'stockQuantity', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => handleDeleteVariant(v.id)} className="text-muted-foreground hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COST/QUANTITY TAB
// ═══════════════════════════════════════════════════════════════════════════════

function CostQuantityTab({
  product,
  saveProduct,
  saving,
}: {
  product: ProductDetail;
  saveProduct: (p: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const baseCost = safeDecimal(product.costPrice);
  const initial: QuantityCostEntry[] = (product.quantityCosts as QuantityCostEntry[]) ?? [];

  const defaultEntries: QuantityCostEntry[] = [2, 3, 4, 5].map((qty) => {
    const existing = initial.find((e) => e.qty === qty);
    return existing ?? { qty, cost: 0, percent: 0 };
  });
  const extraEntries = initial.filter((e) => e.qty > 5);
  const [entries, setEntries] = useState<QuantityCostEntry[]>([...defaultEntries, ...extraEntries]);

  const updateCost = (idx: number, costStr: string) => {
    const cost = parseFloat(costStr) || 0;
    const updated = [...entries];
    const percent = baseCost > 0 ? Math.round((cost / baseCost) * 100) : 0;
    updated[idx] = { ...updated[idx], cost, percent };
    setEntries(updated);
  };

  const addRow = () => {
    const maxQty = entries.length > 0 ? Math.max(...entries.map((e) => e.qty)) : 5;
    setEntries([...entries, { qty: maxQty + 1, cost: 0, percent: 0 }]);
  };

  const removeRow = (idx: number) => {
    if (entries[idx].qty <= 5) return;
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const filtered = entries.filter((e) => e.cost > 0);
    saveProduct({ quantityCosts: filtered });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 max-w-2xl">
      <h2 className="text-sm font-semibold text-foreground mb-2">Cost / Quantity Scaling</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Define the total cost for each quantity level. The system auto-calculates the percentage based on the base cost.
      </p>

      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Quantity</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Total Cost ($)</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Auto %</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Cost / Unit</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/50 bg-muted/20">
            <td className="px-3 py-2 font-medium text-foreground">1 (base)</td>
            <td className="px-3 py-2 text-right font-mono text-foreground">{moneyWhole(baseCost)}</td>
            <td className="px-3 py-2 text-right text-muted-foreground font-mono">100%</td>
            <td className="px-3 py-2 text-right font-mono text-foreground">{moneyWhole(baseCost)}</td>
            <td></td>
          </tr>
          {entries.map((entry, idx) => (
            <tr key={entry.qty} className="border-b border-border/50">
              <td className="px-3 py-2 font-medium text-foreground">{entry.qty} pcs</td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  step="0.01"
                  className={smallInputCls + ' text-right w-28 ml-auto block'}
                  value={entry.cost || ''}
                  onChange={(e) => updateCost(idx, e.target.value)}
                  placeholder="0.00"
                />
              </td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {entry.percent > 0 ? `${entry.percent}%` : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono text-foreground">
                {entry.cost > 0 ? moneyWhole(entry.cost / entry.qty) : '—'}
              </td>
              <td className="px-3 py-2">
                {entry.qty > 5 && (
                  <button onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-red-400">
                    <X size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={addRow} className="text-sm text-amber-400 hover:text-amber-300 mb-4 block">
        + Add more quantity
      </button>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        <Save size={14} /> {saving ? 'Saving...' : 'Save Cost Table'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LABELS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function LabelsTab({
  product,
  allLabels,
  refetch,
  refetchLabels,
}: {
  product: ProductDetail;
  allLabels: LabelItem[];
  refetch: () => void;
  refetchLabels: () => void;
}) {
  const toast = useToastStore((s) => s.add);
  const currentLabelIds = new Set(product.labels.map((l) => l.labelId));
  const [selected, setSelected] = useState<Set<string>>(currentLabelIds);
  const [newLabel, setNewLabel] = useState('');
  const [syncing, setSyncing] = useState(false);

  const toggleLabel = (labelId: string) => {
    const next = new Set(selected);
    if (next.has(labelId)) next.delete(labelId);
    else next.add(labelId);
    setSelected(next);
  };

  const handleCreateLabel = async () => {
    if (!newLabel.trim()) return;
    try {
      const created = await apiPost<LabelItem>('/admin/products/labels', { name: newLabel.trim() });
      toast(`Label "${created.name}" created`, 'success');
      setNewLabel('');
      refetchLabels();
      setSelected(new Set([...selected, created.id]));
    } catch {
      toast('Create label failed', 'error');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiPost(`/admin/products/${product.id}/labels/sync`, { labelIds: Array.from(selected) });
      toast('Labels synced', 'success');
      refetch();
    } catch {
      toast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
      <h2 className="text-sm font-semibold text-foreground mb-4">Product Labels</h2>
      <div className="space-y-2 mb-4">
        {allLabels.map((label) => (
          <label key={label.id} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={selected.has(label.id)} onChange={() => toggleLabel(label.id)} className="accent-amber-500" />
            <span className="text-sm text-foreground">{label.name}</span>
            {label._count && <span className="text-xs text-muted-foreground">({label._count.products} products)</span>}
          </label>
        ))}
        {allLabels.length === 0 && <p className="text-sm text-muted-foreground">No labels yet. Create one below.</p>}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className={smallInputCls + ' max-w-xs'}
          placeholder="New label name"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
        />
        <button onClick={handleCreateLabel} className="px-3 py-1.5 bg-muted text-foreground rounded text-sm hover:bg-muted/80">
          <Plus size={14} />
        </button>
      </div>

      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
      >
        <Save size={14} /> {syncing ? 'Syncing...' : 'Save Labels'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING RULES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PricingRulesTab({
  product,
  refetch,
}: {
  product: ProductDetail;
  refetch: () => void;
}) {
  const toast = useToastStore((s) => s.add);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    suggestedRetail: '',
    sellerTakePercent: '',
    sellerTakeFixed: '',
    holdPercent: '',
    holdDurationDays: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveUntil: '',
    isActive: true,
  });

  const handleCreate = async () => {
    try {
      await apiPost(`/admin/products/${product.id}/pricing-rules`, {
        suggestedRetail: parseFloat(form.suggestedRetail),
        sellerTakePercent: parseFloat(form.sellerTakePercent),
        sellerTakeFixed: form.sellerTakeFixed ? parseFloat(form.sellerTakeFixed) : undefined,
        holdPercent: form.holdPercent ? parseFloat(form.holdPercent) : undefined,
        holdDurationDays: form.holdDurationDays ? parseInt(form.holdDurationDays) : undefined,
        effectiveFrom: form.effectiveFrom,
        effectiveUntil: form.effectiveUntil || undefined,
        isActive: form.isActive,
      });
      toast('Pricing rule created', 'success');
      setShowAdd(false);
      setForm({
        suggestedRetail: '',
        sellerTakePercent: '',
        sellerTakeFixed: '',
        holdPercent: '',
        holdDurationDays: '',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveUntil: '',
        isActive: true,
      });
      refetch();
    } catch {
      toast('Create failed', 'error');
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await apiDelete(`/admin/products/${product.id}/pricing-rules/${ruleId}`);
      toast('Rule deleted', 'success');
      refetch();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  const handleToggleActive = async (rule: PricingRuleData) => {
    try {
      await apiPatch(`/admin/products/${product.id}/pricing-rules/${rule.id}`, { isActive: !rule.isActive });
      toast(rule.isActive ? 'Rule deactivated' : 'Rule activated', 'success');
      refetch();
    } catch {
      toast('Update failed', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Pricing Rules ({product.pricingRules.length})</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">New Pricing Rule</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Suggested Retail ($) *</label>
              <input className={smallInputCls} type="number" step="0.01" value={form.suggestedRetail} onChange={(e) => setForm({ ...form, suggestedRetail: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Seller Take (%) *</label>
              <input className={smallInputCls} type="number" step="0.1" value={form.sellerTakePercent} onChange={(e) => setForm({ ...form, sellerTakePercent: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Seller Take Fixed ($)</label>
              <input className={smallInputCls} type="number" step="0.01" value={form.sellerTakeFixed} onChange={(e) => setForm({ ...form, sellerTakeFixed: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Hold (%)</label>
              <input className={smallInputCls} type="number" step="0.1" value={form.holdPercent} onChange={(e) => setForm({ ...form, holdPercent: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Hold Days</label>
              <input className={smallInputCls} type="number" value={form.holdDurationDays} onChange={(e) => setForm({ ...form, holdDurationDays: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Effective From *</label>
              <input className={smallInputCls} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Effective Until</label>
              <input className={smallInputCls} type="date" value={form.effectiveUntil} onChange={(e) => setForm({ ...form, effectiveUntil: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-amber-500" />
                <span className="text-sm text-foreground">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreate} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">Create</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {product.pricingRules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No pricing rules yet.</p>
      ) : (
        <div className="space-y-3">
          {product.pricingRules.map((rule) => (
            <div key={rule.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 flex-1">
                <div>
                  <span className="text-xs text-muted-foreground">Retail</span>
                  <p className="text-sm font-mono text-foreground font-medium">{moneyDecimal(rule.suggestedRetail)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Seller Take</span>
                  <p className="text-sm font-mono text-foreground">{safeDecimal(rule.sellerTakePercent)}%</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Effective</span>
                  <p className="text-xs text-foreground">{fmtDate(rule.effectiveFrom)}</p>
                </div>
                <div>
                  <StatusBadge status={rule.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => handleToggleActive(rule)} className="px-2 py-1 text-xs border border-border rounded hover:bg-muted">
                  {rule.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(rule.id)} className="text-muted-foreground hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function StatsTab({ product }: { product: ProductDetail }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard label="Variants" value={num(product.variants.length)} />
      <KpiCard label="Sellpages" value={num(product._count.sellpages)} />
      <KpiCard label="Order Items" value={num(product._count.orderItems)} />
      <KpiCard label="Reviews" value={num(product.reviewCount)} />
      <KpiCard label="Rating" value={safeDecimal(product.rating).toFixed(1)} />
      <KpiCard label="Labels" value={num(product.labels.length)} />
      <KpiCard label="Pricing Rules" value={num(product.pricingRules.length)} />
      <KpiCard label="Images" value={num(((product.images as string[]) ?? []).length)} />
    </div>
  );
}
