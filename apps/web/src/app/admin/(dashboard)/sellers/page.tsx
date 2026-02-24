'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Search } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_SELLERS, type MockSeller } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response type ───────────────────────────────────────────────────────

interface SellerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'PENDING' | 'DEACTIVATED' | 'REJECTED';
  paymentGateway: string | null;
  stores: number;
  products: number;
  orders: number;
  revenue: number;
  roas: number;
  createdAt: string;
}

interface SellersResponse {
  data: SellerRow[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_TABS = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Deactivated', value: 'DEACTIVATED' },
  { label: 'Rejected', value: 'REJECTED' },
];

function roasColor(roas: number) {
  if (roas >= 3) return 'text-green-400';
  if (roas >= 2) return 'text-yellow-400';
  return 'text-red-400';
}

function PaymentBadge({ gateway }: { gateway: string | null }) {
  if (!gateway) return <span className="text-muted-foreground text-xs">—</span>;
  if (gateway === 'stripe')
    return <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-full text-[11px] font-medium">Stripe</span>;
  return <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full text-[11px] font-medium">PayPal</span>;
}

export default function AdminSellersPage() {
  const router = useRouter();
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');

  // Build API query string
  const apiPath = useMemo(() => {
    if (IS_PREVIEW) return null;
    const params = new URLSearchParams();
    params.set('limit', '100'); // fetch all for client-side filtering
    if (tab !== 'ALL') params.set('status', tab);
    if (search.trim()) params.set('search', search.trim());
    return `/admin/sellers?${params.toString()}`;
  }, [tab, search]);

  const { data: apiData, loading, error } = useAdminApi<SellersResponse>(apiPath);

  // Resolve data source
  const allSellers: SellerRow[] = IS_PREVIEW
    ? (MOCK_SELLERS as SellerRow[])
    : apiData?.data ?? [];

  // Client-side filtering for preview mode (API handles filtering in real mode)
  const filtered = useMemo(() => {
    if (!IS_PREVIEW) return allSellers;
    let data = tab === 'ALL' ? allSellers : allSellers.filter((s) => s.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    return data;
  }, [allSellers, tab, search]);

  // Counts for tabs
  const counts = useMemo(() => {
    const src = IS_PREVIEW ? (MOCK_SELLERS as SellerRow[]) : allSellers;
    return {
      ALL: src.length,
      ACTIVE: src.filter((s) => s.status === 'ACTIVE').length,
      PENDING: src.filter((s) => s.status === 'PENDING').length,
      DEACTIVATED: src.filter((s) => s.status === 'DEACTIVATED').length,
      REJECTED: src.filter((s) => s.status === 'REJECTED').length,
    };
  }, [allSellers]);

  const columns: Column<SellerRow>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'payment', label: 'Payment', render: (r) => <PaymentBadge gateway={r.paymentGateway} /> },
    { key: 'stores', label: 'Stores', className: 'text-right', render: (r) => <span className="font-mono text-sm">{r.stores}</span> },
    { key: 'products', label: 'Products', className: 'text-right', render: (r) => <span className="font-mono text-sm">{r.products}</span> },
    { key: 'orders', label: 'Orders', className: 'text-right', render: (r) => <span className="font-mono text-sm">{num(r.orders)}</span> },
    { key: 'revenue', label: 'Revenue', className: 'text-right', render: (r) => <span className="font-mono text-sm">{r.revenue > 0 ? moneyWhole(r.revenue) : '—'}</span> },
    { key: 'roas', label: 'ROAS', className: 'text-right', render: (r) => <span className={`font-mono text-sm ${roasColor(r.roas)}`}>{r.roas > 0 ? r.roas.toFixed(1) : '—'}</span> },
    { key: 'created', label: 'Created', render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <PageShell
      title="Sellers"
      icon={<Users size={22} className="text-amber-400" />}
      actions={
        <button
          onClick={() => router.push('/admin/sellers/new')}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus size={14} />
          Add Seller
        </button>
      }
    >
      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-4 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label} ({counts[t.value as keyof typeof counts]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
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
        emptyMessage="No sellers found."
        onRowClick={(r) => router.push(`/admin/sellers/${r.id}`)}
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
