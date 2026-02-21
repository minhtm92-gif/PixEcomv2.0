'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Search,
  ChevronRight,
  Download,
  Upload,
  X,
  Loader2,
  FileUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { apiGet, getAccessToken, getApiBaseUrl, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime, money, today, daysAgo } from '@/lib/format';
import type { OrderListItem, OrderListResponse, ImportTrackingResult } from '@/types/api';

const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

const SOURCES = ['ALL', 'Facebook', 'TikTok', 'Google', 'Email', 'Direct', 'Other'];

const SOURCE_COLORS: Record<string, string> = {
  facebook: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  tiktok: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  google: 'bg-green-500/15 text-green-400 border-green-500/30',
  email: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  direct: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  other: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-xs text-muted-foreground">—</span>;
  const key = source.toLowerCase();
  const cls = SOURCE_COLORS[key] ?? SOURCE_COLORS.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {source}
    </span>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [data, setData] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Cursor pagination
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportTrackingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOrders = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      params.set('limit', '20');
      if (status !== 'ALL') params.set('status', status);
      if (source !== 'ALL') params.set('source', source);
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
  }, [status, source, dateFrom, dateTo, search]);

  useEffect(() => {
    setCursors([null]);
    setCurrentPage(0);
    fetchOrders(null);
  }, [fetchOrders]);

  function handleSearch(e: FormEvent) {
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

  // ── Export CSV ──
  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      if (status !== 'ALL') params.set('status', status);
      if (source !== 'ALL') params.set('source', source);
      if (search.trim()) params.set('search', search.trim());

      const base = getApiBaseUrl();
      const token = getAccessToken();
      const res = await fetch(`${base}/orders/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 429) {
        addToast('Export rate limited — please wait a moment', 'error');
        return;
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        addToast((payload as { message?: string }).message ?? 'Export failed', 'error');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${dateFrom}_${dateTo}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast('CSV exported', 'success');
    } catch {
      addToast('Export failed — network error', 'error');
    } finally {
      setExporting(false);
    }
  }

  // ── Import tracking modal helpers ──
  function openImportModal() {
    setImportOpen(true);
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
  }

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    // Parse preview (first 5 data rows + header)
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.slice(0, 6).map((line) =>
        line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()),
      );
      setImportPreview(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    try {
      const base = getApiBaseUrl();
      const token = getAccessToken();
      const formData = new FormData();
      formData.append('file', importFile);

      const res = await fetch(`${base}/orders/import-tracking`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        addToast((payload as { message?: string }).message ?? 'Import failed', 'error');
        return;
      }

      const result: ImportTrackingResult = await res.json();
      setImportResult(result);
      addToast(`Tracking imported: ${result.updated} updated, ${result.failed} failed`, result.failed > 0 ? 'warning' : 'success');

      // Refresh the list
      fetchOrders(cursors[currentPage]);
    } catch {
      addToast('Import failed — network error', 'error');
    } finally {
      setImporting(false);
    }
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
      key: 'source',
      label: 'Source',
      render: (r) => <SourceBadge source={r.source} />,
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
      key: 'tracking',
      label: 'Tracking',
      render: (r) =>
        r.trackingNumber ? (
          r.trackingUrl ? (
            <a
              href={r.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary font-mono hover:underline"
            >
              {r.trackingNumber}
            </a>
          ) : (
            <span className="text-xs text-foreground font-mono">{r.trackingNumber}</span>
          )
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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

  const inputCls =
    'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

  return (
    <>
      <PageShell
        title="Orders"
        subtitle={`Showing results for ${dateFrom} — ${dateTo}`}
        icon={<ClipboardList size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                         hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
            <button
              onClick={openImportModal}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 transition-opacity"
            >
              <Upload size={14} />
              Import Tracking
            </button>
          </div>
        }
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

          {/* Source filter */}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground
                       focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All sources' : s}</option>
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

      {/* ── Import Tracking Modal ── */}
      {importOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !importing && setImportOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative bg-card border border-border rounded-xl w-full max-w-lg mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Upload size={18} />
                Import Tracking Numbers
              </h2>
              <button
                onClick={() => !importing && setImportOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Instructions */}
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns: <span className="font-mono text-foreground">order_number</span>,{' '}
                <span className="font-mono text-foreground">tracking_number</span>,{' '}
                <span className="font-mono text-foreground">tracking_url</span> (optional)
              </p>

              {/* File picker */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className={`flex items-center justify-center gap-3 w-full py-6 border-2 border-dashed rounded-lg transition-colors
                    ${importFile
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FileUp size={20} className="text-muted-foreground" />
                  <div className="text-left">
                    {importFile ? (
                      <>
                        <p className="text-sm font-medium text-foreground">{importFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">Click to select CSV file</p>
                        <p className="text-xs text-muted-foreground/60">or drag & drop</p>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Preview table */}
              {importPreview && importPreview.length > 0 && !importResult && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/50 border-b border-border">
                    Preview (first {Math.min(importPreview.length - 1, 5)} rows)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {importPreview[0].map((h, i) => (
                            <th key={i} className="text-left px-3 py-1.5 text-muted-foreground font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.slice(1).map((row, ri) => (
                          <tr key={ri} className="border-b border-border last:border-0">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-1.5 text-foreground font-mono">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={16} className="text-green-400" />
                      <span className="text-foreground">{importResult.updated} updated</span>
                    </div>
                    {importResult.failed > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle size={16} className="text-amber-400" />
                        <span className="text-foreground">{importResult.failed} failed</span>
                      </div>
                    )}
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="border border-red-500/20 bg-red-500/5 rounded-lg overflow-hidden">
                      <p className="text-xs text-red-400 px-3 py-2 border-b border-red-500/20 font-medium">Errors</p>
                      <div className="max-h-32 overflow-y-auto">
                        {importResult.errors.map((err, i) => (
                          <div key={i} className="px-3 py-1.5 text-xs border-b border-red-500/10 last:border-0">
                            <span className="text-muted-foreground">Row {err.row}</span>{' '}
                            <span className="font-mono text-foreground">{err.orderNumber}</span>{' '}
                            <span className="text-red-400">— {err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  disabled={importing}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                {!importResult && (
                  <button
                    onClick={handleImport}
                    disabled={importing || !importFile}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                               hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {importing && <Loader2 size={14} className="animate-spin" />}
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
