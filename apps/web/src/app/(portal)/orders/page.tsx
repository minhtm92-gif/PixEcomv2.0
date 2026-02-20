'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search, ChevronRight } from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime, money, today, daysAgo } from '@/lib/format';
import type { OrderListItem, OrderListResponse } from '@/types/api';

const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export default function OrdersPage() {
  const router = useRouter();

  const [data, setData] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Cursor pagination
  const [cursors, setCursors] = useState<(string | null)[]>([null]); // stack of cursors
  const [currentPage, setCurrentPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchOrders = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      params.set('limit', '20');
      if (status !== 'ALL') params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      if (cursor) params.set('cursor', cursor);

      const res = await apiGet<OrderListResponse>(`/orders?${params.toString()}`);
      setData(res.items);
      setNextCursor(res.nextCursor);
    } catch (err) {
      const e = err as ApiError;
      setError(e.message ?? 'Failed to load orders');
      toastApiError(e);
    } finally {
      setLoading(false);
    }
  }, [status, dateFrom, dateTo, search]);

  // Initial fetch
  useEffect(() => {
    setCursors([null]);
    setCurrentPage(0);
    fetchOrders(null);
  }, [fetchOrders]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  function goNext() {
    if (!nextCursor) return;
    const newPage = currentPage + 1;
    const newCursors = [...cursors];
    newCursors[newPage] = nextCursor;
    setCursors(newCursors);
    setCurrentPage(newPage);
    fetchOrders(nextCursor);
  }

  function goPrev() {
    if (currentPage === 0) return;
    const prevPage = currentPage - 1;
    setCurrentPage(prevPage);
    fetchOrders(cursors[prevPage]);
  }

  const columns: Column<OrderListItem>[] = [
    {
      key: 'orderNumber',
      label: 'Order',
      render: (r) => <span className="font-mono text-foreground font-medium">{r.orderNumber}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (r) => <span className="text-muted-foreground whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'total',
      label: 'Total',
      className: 'text-right',
      render: (r) => <span className="font-mono text-foreground">{money(r.total, r.currency)}</span>,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => (
        <div>
          <p className="text-foreground">{r.customer.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{r.customer.email}</p>
        </div>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      className: 'text-center',
      render: (r) => <span className="text-muted-foreground">{r.itemsCount}</span>,
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
      title="Orders"
      subtitle={`Showing results for ${dateFrom} — ${dateTo}`}
      icon={<ClipboardList size={22} />}
    >
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order # or email..."
              className="pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90">
            Search
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
          <button onClick={() => fetchOrders(cursors[currentPage])} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="No orders yet."
        onRowClick={(r) => router.push(`/orders/${r.id}`)}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-muted-foreground">
          Page {currentPage + 1} {data.length > 0 && `• ${data.length} rows`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={goPrev}
            disabled={currentPage === 0}
            className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <button
            onClick={goNext}
            disabled={!nextCursor}
            className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </PageShell>
  );
}
