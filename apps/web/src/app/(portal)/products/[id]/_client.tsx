'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { moneyDecimal, safeFmtDate } from '@/lib/format';
import { PageShell } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { ShoppingBag, ArrowLeft, Package } from 'lucide-react';
import type { ProductDetail } from '@/types/api';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<ProductDetail>(`/products/${id}`);
        setProduct(data);
      } catch (err) {
        const e = err as ApiError;
        setError(e.message ?? 'Failed to load product');
        toastApiError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error ?? 'Product not found'}
        </div>
      </div>
    );
  }

  return (
    <PageShell
      title={product.name}
      subtitle={`${product.productCode} • ${product.currency}`}
      icon={<ShoppingBag size={22} />}
    >
      {/* Back button */}
      <button
        onClick={() => router.push('/products')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={14} /> Back to Products
      </button>

      {/* Overview card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Image */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center">
          {product.heroImageUrl ? (
            <img
              src={product.heroImageUrl}
              alt={product.name}
              className="max-h-48 rounded object-contain"
            />
          ) : (
            <div className="w-32 h-32 bg-muted rounded flex items-center justify-center">
              <ShoppingBag size={32} className="text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={product.status} />
            <span className="text-xs text-muted-foreground font-mono">{product.productCode}</span>
          </div>

          <h2 className="text-lg font-bold text-foreground">{product.name}</h2>

          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Suggested Retail</p>
              <p className="text-lg font-mono font-bold text-foreground">
                {moneyDecimal(product.suggestedRetailPrice, product.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">You Take (est.)</p>
              <p className="text-lg font-mono font-bold text-green-400">
                {product.youTakeEstimate ? moneyDecimal(product.youTakeEstimate, product.currency) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm text-foreground">{safeFmtDate(product.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-sm text-foreground">{safeFmtDate(product.updatedAt)}</p>
            </div>
          </div>

          {/* Labels */}
          {product.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {product.labels.map((l) => (
                <span key={l.id} className="inline-block px-2 py-0.5 rounded text-xs capitalize bg-primary/10 text-primary border border-primary/20">
                  {l.name}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {product.tags.map((t) => (
                <span key={t} className="inline-block px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Variants table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Package size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Variants ({product.variants.length})
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Variant</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Compare At</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Active</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No variants found.
                </td>
              </tr>
            ) : (
              product.variants.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{v.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {moneyDecimal(v.effectivePrice, product.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {v.compareAtPrice ? moneyDecimal(v.compareAtPrice, product.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{v.stockQuantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${v.isActive ? 'text-green-400' : 'text-red-400'}`}>
                      {v.isActive ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
