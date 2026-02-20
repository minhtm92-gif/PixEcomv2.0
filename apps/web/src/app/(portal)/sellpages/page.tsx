'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/format';
import type { SellpageListItem, SellpagesListResponse } from '@/types/api';

const STATUSES = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function SellpagesPage() {
  const router = useRouter();

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
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

  return (
    <PageShell
      title="Sellpages"
      subtitle={`${total} sellpage${total !== 1 ? 's' : ''}`}
      icon={<FileText size={22} />}
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
  );
}
