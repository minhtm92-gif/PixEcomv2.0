'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { moneyDecimal } from '@/lib/format';
import { ShoppingBag, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductCardItem, ProductsListResponse } from '@/types/api';

/**
 * Backend contract: GET /api/products
 * Response: { data: ProductCardItem[], total: number, page: number, limit: number }
 *
 * ProductCardItem fields:
 *  - suggestedRetailPrice: string (Prisma Decimal)
 *  - youTakeEstimate: string | null (Prisma Decimal)
 *  - labels: { id, name, slug }[]
 *  - heroImageUrl: string | null
 *  - NO createdAt in list (only in detail)
 */

export default function ProductsPage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [label, setLabel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const pageCount = Math.ceil(total / limit) || 1;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (label) params.set('label', label);
      if (search.trim()) params.set('q', search.trim());

      const res = await apiGet<ProductsListResponse>(`/products?${params.toString()}`);
      setProducts(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr?.message ?? 'Failed to load products');
      toastApiError(apiErr);
    } finally {
      setLoading(false);
    }
  }, [page, limit, label, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShoppingBag size={22} />
          Products
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform product catalog ({total} total)
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => { setLabel(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !label ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>

        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products..."
              className="pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                         focus:border-primary transition-colors w-48"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium
                       hover:opacity-90 transition-opacity"
          >
            Search
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={fetchProducts} className="ml-3 underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Code</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggested Price</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">You Take</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-40 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <p>No products found.</p>
                  <p className="mt-2 text-xs text-muted-foreground/60">
                    Hint: <code className="bg-muted/40 px-1.5 py-0.5 rounded text-[11px]">If staging DB is empty, run: pnpm seed:staging</code>
                  </p>
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/products/${p.id}`)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.heroImageUrl ? (
                        <img
                          src={p.heroImageUrl}
                          alt={p.name}
                          className="w-8 h-8 rounded object-cover bg-muted"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <ShoppingBag size={14} className="text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-foreground font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">/{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {moneyDecimal(p.suggestedRetailPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    {p.youTakeEstimate ? moneyDecimal(p.youTakeEstimate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.labels.length > 0 ? (
                        p.labels.map((l) => (
                          <span
                            key={l.id}
                            className="inline-block px-2 py-0.5 rounded text-xs capitalize bg-muted text-muted-foreground"
                          >
                            {l.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs
                         hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs
                         hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
