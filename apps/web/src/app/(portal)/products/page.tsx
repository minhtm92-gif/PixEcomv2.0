'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { ShoppingBag, Search, ChevronLeft, ChevronRight } from 'lucide-react';

/* ── Types matching backend DTO ── */
interface Product {
  id: string;
  name: string;
  label: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

interface ProductsResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  };
}

const LABELS = ['all', 'physical', 'digital', 'subscription', 'bundle'] as const;

export default function ProductsPage() {
  const addToast = useToastStore((s) => s.add);

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [label, setLabel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (label !== 'all') params.set('label', label);
      if (search.trim()) params.set('q', search.trim());

      const res = await apiGet<ProductsResponse>(`/products?${params.toString()}`);
      setProducts(res.data);
      setMeta(res.meta);
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
          Platform product catalog ({meta?.total ?? 0} total)
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Label filter */}
        <div className="flex gap-1">
          {LABELS.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLabel(l);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                label === l
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Search */}
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
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Product
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Label
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Price
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-40 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 animate-pulse ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20 animate-pulse" /></td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
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
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {p.description ?? 'No description'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs capitalize bg-muted text-muted-foreground">
                      {p.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    ${(p.price / 100).toFixed(2)}
                    {p.compareAtPrice != null && (
                      <span className="ml-1.5 text-xs text-muted-foreground line-through">
                        ${(p.compareAtPrice / 100).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.pageCount > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.pageCount}
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
              onClick={() => setPage((p) => Math.min(meta.pageCount, p + 1))}
              disabled={page >= meta.pageCount}
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

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    archived: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded border text-xs capitalize ${
        colors[status] ?? colors.draft
      }`}
    >
      {status}
    </span>
  );
}
