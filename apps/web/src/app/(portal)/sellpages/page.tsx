'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, ChevronRight, ChevronLeft, Plus, X, Loader2 } from 'lucide-react';
import { apiGet, apiPost, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/format';
import type {
  SellpageListItem,
  SellpagesListResponse,
  ProductCardItem,
  ProductsListResponse,
  CreateSellpageDto,
  SellpageDetail,
} from '@/types/api';

const STATUSES = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function SellpagesPage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [data, setData] = useState<SellpageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const pageCount = Math.ceil(total / limit) || 1;

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchSellpages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (status !== 'ALL') params.set('status', status);
      if (search.trim()) params.set('q', search.trim());

      const res = await apiGet<SellpagesListResponse>(`/sellpages?${params.toString()}`);
      setData(res.data);
      setTotal(res.total);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load sellpages');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, status, search]);

  useEffect(() => {
    fetchSellpages();
  }, [fetchSellpages]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  // ── Open modal → fetch products ──
  async function openModal() {
    setModalOpen(true);
    setModalError(null);
    setNewProductId('');
    setNewSlug('');
    setNewTitle('');
    setNewDesc('');

    if (products.length === 0) {
      setProductsLoading(true);
      try {
        const res = await apiGet<ProductsListResponse>('/products?limit=100');
        setProducts(res.data);
      } catch (err) {
        toastApiError(err as ApiError);
      } finally {
        setProductsLoading(false);
      }
    }
  }

  // ── Create sellpage ──
  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newProductId || !newSlug.trim()) return;
    setModalError(null);
    setCreating(true);

    try {
      const body: CreateSellpageDto = {
        productId: newProductId,
        slug: newSlug.trim(),
      };
      if (newTitle.trim()) body.titleOverride = newTitle.trim();
      if (newDesc.trim()) body.descriptionOverride = newDesc.trim();

      const created = await apiPost<SellpageDetail>('/sellpages', body);
      addToast('Sellpage created', 'success');
      setModalOpen(false);
      router.push(`/sellpages/${created.id}`);
    } catch (err) {
      const e = err as ApiError;
      setModalError(e.message ?? 'Failed to create sellpage');
      toastApiError(e);
    } finally {
      setCreating(false);
    }
  }

  const columns: Column<SellpageListItem>[] = [
    {
      key: 'name',
      label: 'Sellpage',
      render: (r) => (
        <div>
          <p className="text-foreground font-medium">{r.titleOverride ?? r.slug}</p>
          <p className="text-xs text-muted-foreground">/{r.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'url',
      label: 'Domain / URL',
      render: (r) => (
        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
          {r.urlPreview}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r) => <span className="text-xs text-muted-foreground capitalize">{r.sellpageType}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: 'action',
      label: '',
      className: 'w-8',
      render: () => <ChevronRight size={14} className="text-muted-foreground" />,
    },
  ];

  const inputCls =
    'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

  return (
    <>
      <PageShell
        title="Sellpages"
        subtitle={`${total} sellpage${total !== 1 ? 's' : ''}`}
        icon={<FileText size={22} />}
        actions={
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            New Sellpage
          </button>
        }
      >
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
            ))}
          </select>

          <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search slug or title..."
                className="pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
            {error}
            <button onClick={fetchSellpages} className="ml-3 underline hover:text-red-300">Retry</button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          rowKey={(r) => r.id}
          emptyMessage="No sellpages found."
          onRowClick={(r) => router.push(`/sellpages/${r.id}`)}
        />

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">Page {page} of {pageCount}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </PageShell>

      {/* ── Create Sellpage Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !creating && setModalOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative bg-card border border-border rounded-xl w-full max-w-md mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">New Sellpage</h2>
              <button
                onClick={() => !creating && setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Product */}
              <div>
                <label htmlFor="sp-product" className="block text-sm text-muted-foreground mb-1.5">
                  Product <span className="text-red-400">*</span>
                </label>
                {productsLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : (
                  <select
                    id="sp-product"
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">Select a product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Slug */}
              <div>
                <label htmlFor="sp-slug" className="block text-sm text-muted-foreground mb-1.5">
                  Slug <span className="text-red-400">*</span>
                </label>
                <input
                  id="sp-slug"
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="my-product-page"
                />
              </div>

              {/* Title Override */}
              <div>
                <label htmlFor="sp-title" className="block text-sm text-muted-foreground mb-1.5">
                  Title Override <span className="text-xs text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  id="sp-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={inputCls}
                  placeholder="Custom page title"
                />
              </div>

              {/* Description Override */}
              <div>
                <label htmlFor="sp-desc" className="block text-sm text-muted-foreground mb-1.5">
                  Description Override <span className="text-xs text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  id="sp-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  className={inputCls + ' resize-none'}
                  placeholder="Custom page description"
                />
              </div>

              {/* Error */}
              {modalError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {modalError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={creating}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProductId || !newSlug.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                             hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Creating...' : 'Create Sellpage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
