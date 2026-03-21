'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { moneyDecimal } from '@/lib/format';
import { ShoppingBag, Search, ChevronLeft, ChevronRight, Package } from 'lucide-react';
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
 */

export default function ProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(12);
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
          <ShoppingBag size={22} className="text-amber-400" />
          Products
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse available products and create sellpages ({total} total)
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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
              className="pl-8 pr-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50
                         focus:border-amber-500 transition-colors w-64"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium
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

      {/* Loading skeleton — card grid */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm">No products found.</p>
          <p className="mt-2 text-xs text-muted-foreground/60">
            Products will appear here once they are published by the platform.
          </p>
        </div>
      )}

      {/* Card Grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => {
            const suggestedRetail = Number(p.suggestedRetailPrice) || 0;
            const youTake = p.youTakeEstimate ? Number(p.youTakeEstimate) : 0;

            return (
              <div
                key={p.id}
                onClick={() => router.push(`/products/${p.id}`)}
                className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all group"
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {p.heroImageUrl ? (
                    <img
                      src={p.heroImageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={48} className="text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Labels */}
                  {p.labels.length > 0 && (
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {p.labels.slice(0, 2).map((l) => (
                        <span
                          key={l.id}
                          className="px-2 py-0.5 rounded text-[10px] font-medium capitalize bg-black/60 text-white backdrop-blur-sm"
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {p.code}
                  </p>

                  <div className="space-y-1 pt-1">
                    {suggestedRetail > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Suggested retail</span>
                        <span className="font-mono text-foreground font-medium">
                          {moneyDecimal(suggestedRetail)}
                        </span>
                      </div>
                    )}
                    {youTake > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">You take</span>
                        <span className="font-mono text-green-400 font-medium">
                          {moneyDecimal(youTake)} / order
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  {p.stats && (p.stats.ordersCount > 0 || p.stats.revenue > 0) && (
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span>{p.stats.ordersCount} orders</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className="font-mono">{moneyDecimal(p.stats.revenue)} rev</span>
                      {p.stats.roas > 0 && (
                        <>
                          <span className="text-muted-foreground/30">|</span>
                          <span className={
                            p.stats.roas >= 3 ? 'text-green-400' : p.stats.roas >= 2 ? 'text-amber-400' : 'text-red-400'
                          }>
                            {p.stats.roas.toFixed(1)}x
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/products/${p.id}`);
                      }}
                      className="w-full text-center py-2 text-xs font-medium text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      + Create a sellpage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-6">
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
