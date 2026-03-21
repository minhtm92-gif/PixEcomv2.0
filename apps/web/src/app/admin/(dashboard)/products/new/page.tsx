'use client';

import { useState, useRef, useCallback } from 'react';
import { Package, Upload, X, ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { useAdminApi, useAdminMutation } from '@/hooks/useAdminApi';
import { useToastStore } from '@/stores/toastStore';
import { apiPost } from '@/lib/apiClient';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

interface SellerOption {
  id: string;
  name: string;
}

interface SellersResponse {
  data: SellerOption[];
  total: number;
  page: number;
  limit: number;
}

interface UploadedImage {
  url: string;
  name: string;
  preview: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const toast = useToastStore((s) => s.add);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Fetch sellers for dropdown
  const { data: sellersData } = useAdminApi<SellersResponse>('/admin/sellers?limit=100');
  const sellers = sellersData?.data ?? [];

  // Mutation
  const { mutate: createProduct, loading: saving } = useAdminMutation<{ id: string }>('/admin/products', 'POST');

  const canSubmit = name.trim().length > 0 && price.trim().length > 0 && !saving && !uploading;

  async function uploadFile(file: File): Promise<UploadedImage | null> {
    try {
      // 1. Get presigned URL from admin API
      const { uploadUrl, publicUrl } = await apiPost<{ uploadUrl: string; publicUrl: string }>(
        '/admin/products/upload',
        { filename: file.name, contentType: file.type },
      );

      // 2. Upload directly to R2
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      return {
        url: publicUrl,
        name: file.name,
        preview: URL.createObjectURL(file),
      };
    } catch (err: any) {
      toast(`Failed to upload ${file.name}: ${err?.message || 'Unknown error'}`, 'error');
      return null;
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const validFiles = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type),
    );

    if (validFiles.length === 0) {
      toast('Please select valid image files (JPG, PNG, GIF, WebP)', 'error');
      return;
    }

    setUploading(true);
    const results = await Promise.all(validFiles.map(uploadFile));
    const uploaded = results.filter(Boolean) as UploadedImage[];
    setImages((prev) => [...prev, ...uploaded]);
    if (uploaded.length > 0) {
      toast(`${uploaded.length} image(s) uploaded`, 'success');
    }
    setUploading(false);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        price: parseFloat(price),
        status,
        images: images.map((img) => img.url),
      };
      if (sku.trim()) body.sku = sku.trim();
      if (description.trim()) body.description = description.trim();
      if (compareAtPrice.trim()) body.compareAtPrice = parseFloat(compareAtPrice);
      if (costPrice.trim()) body.costPrice = parseFloat(costPrice);

      await createProduct(body);
      toast('Product created successfully', 'success');
      router.push('/admin/products');
    } catch {
      toast('Failed to create product', 'error');
    }
  }

  function handleDiscard() {
    // Cleanup preview URLs
    images.forEach((img) => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
    router.push('/admin/products');
  }

  return (
    <PageShell
      icon={<Package size={20} className="text-amber-400" />}
      backHref="/admin/products"
      backLabel="Products"
      title="Add New Product"
      actions={
        <>
          <button
            onClick={handleDiscard}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Discard
          </button>
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={`px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors ${
              canSubmit ? 'hover:bg-amber-400 cursor-pointer' : 'opacity-60 cursor-not-allowed'
            }`}
          >
            {saving ? 'Creating...' : 'Create Product'}
          </button>
        </>
      }
    >
      {/* Section 1: Product Information */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Product Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Title / Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">SKU</label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. SKU-001"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              rows={3}
              className={inputCls}
              placeholder="Enter product description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Status</label>
            <select
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Pricing */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Price ($) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Compare At Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              placeholder="0.00"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cost Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputCls}
              placeholder="0.00"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Images */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Images</h2>

        {/* Image previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {images.map((img, i) => (
              <div key={img.url} className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-square">
                <img
                  src={img.preview || img.url}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-xs text-white truncate">{img.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        <div
          className={`border-2 border-dashed rounded-lg h-40 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-amber-500 bg-amber-500/10'
              : 'border-border hover:border-muted-foreground'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag &amp; drop images here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts JPG, PNG, GIF, WebP
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Available sellers info */}
      {sellers.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Available Sellers</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {sellers.length} seller(s) registered. Products are created at the platform level and can be assigned to sellpages.
          </p>
          <div className="flex flex-wrap gap-2">
            {sellers.map((s) => (
              <span
                key={s.id}
                className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
