'use client';

import { useState, useMemo } from 'react';
import { ClipboardList, Upload, Download, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_ADMIN_ORDERS, type MockAdminOrder } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response type ───────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  orderNumber: string;
  sellerName: string;
  sellerId: string;
  customer: string;
  product: string;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  trackingNumber: string | null;
  transactionId: string | null;
  createdAt: string;
  hasHighQty?: boolean;
  maxQty?: number;
}

interface OrdersResponse {
  data: OrderRow[];
  total: number;
  page: number;
  limit: number;
}

const ALL_STATUSES = ['All', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState('All');
  const [search, setSearch] = useState('');

  // Build API query string
  const apiPath = useMemo(() => {
    if (IS_PREVIEW) return null;
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (statusTab !== 'All') params.set('status', statusTab);
    if (search.trim()) params.set('search', search.trim());
    return `/admin/orders?${params.toString()}`;
  }, [statusTab, search]);

  const { data: apiData, loading, error } = useAdminApi<OrdersResponse>(apiPath);

  // Resolve data source
  const allOrders: OrderRow[] = IS_PREVIEW
    ? (MOCK_ADMIN_ORDERS as OrderRow[])
    : apiData?.data ?? [];

  // Client-side filtering for preview mode (API handles filtering in real mode)
  const filtered = useMemo(() => {
    if (!IS_PREVIEW) return allOrders;
    return allOrders.filter((o) => {
      const matchStatus = statusTab === 'All' || o.status === statusTab;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.sellerName.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [allOrders, statusTab, search]);

  // Tab counts — for preview use full mock list, for API use unfiltered count
  const tabCounts = useMemo(() => {
    const src = IS_PREVIEW ? (MOCK_ADMIN_ORDERS as OrderRow[]) : allOrders;
    return {
      All: src.length,
      PENDING: src.filter((o) => o.status === 'PENDING').length,
      CONFIRMED: src.filter((o) => o.status === 'CONFIRMED').length,
      PROCESSING: src.filter((o) => o.status === 'PROCESSING').length,
      SHIPPED: src.filter((o) => o.status === 'SHIPPED').length,
      DELIVERED: src.filter((o) => o.status === 'DELIVERED').length,
      CANCELLED: src.filter((o) => o.status === 'CANCELLED').length,
      REFUNDED: src.filter((o) => o.status === 'REFUNDED').length,
    };
  }, [allOrders]);

  const columns: Column<OrderRow>[] = [
    {
      key: 'orderNumber',
      label: 'Order #',
      render: (r) => (
        <span className="font-mono text-sm font-medium text-foreground inline-flex items-center gap-1.5">
          {r.hasHighQty && (
            <span title={`High quantity order (max ${r.maxQty} pcs)`} className="text-amber-400">
              <AlertTriangle size={14} />
            </span>
          )}
          {r.orderNumber}
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => <span className="text-sm text-foreground">{r.customer}</span>,
    },
    {
      key: 'product',
      label: 'Product',
      render: (r) => (
        <span className="text-sm text-muted-foreground truncate max-w-[180px] block">{r.product}</span>
      ),
    },
    {
      key: 'sellerName',
      label: 'Seller',
      render: (r) => <span className="text-sm text-muted-foreground">{r.sellerName}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'trackingNumber',
      label: 'Tracking #',
      render: (r) => (
        <span className="text-xs font-mono text-muted-foreground">{r.trackingNumber ?? '\u2014'}</span>
      ),
    },
    {
      key: 'transactionId',
      label: 'Transaction',
      render: (r) => (
        <span className="text-xs font-mono text-muted-foreground">{r.transactionId ?? '\u2014'}</span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">{moneyWhole(r.total)}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      className: 'text-right',
      render: (r) => {
        const d = new Date(r.createdAt);
        return <span className="text-xs text-muted-foreground">{d.toISOString().slice(0, 10)}</span>;
      },
    },
  ];

  return (
    <PageShell
      icon={<ClipboardList size={20} className="text-amber-400" />}
      title="Orders"
      subtitle="All platform orders across sellers"
      actions={
        <>
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground font-medium rounded-lg text-sm transition-colors opacity-50 cursor-not-allowed"
          >
            <Upload size={16} />
            Upload Tracking
          </button>
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground font-medium rounded-lg text-sm transition-colors opacity-50 cursor-not-allowed"
          >
            <Download size={16} />
            Export CSV
          </button>
        </>
      }
    >
      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit flex-wrap">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusTab(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusTab === s
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'All' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}{' '}
            <span className="ml-1 text-muted-foreground">{tabCounts[s as keyof typeof tabCounts]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search orders, customers, sellers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Error */}
      {!IS_PREVIEW && error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={!IS_PREVIEW && loading}
        emptyMessage="No orders found."
        onRowClick={(r) => router.push(`/admin/orders/${r.id}`)}
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
