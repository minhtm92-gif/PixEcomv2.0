'use client';

import { useState, useMemo } from 'react';
import { Globe, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { num, fmtDate } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_STORES, type MockStore } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response type ───────────────────────────────────────────────────────

interface StoreApiRow {
  id: string;
  hostname: string;
  verificationMethod: string;
  verificationToken: string;
  status: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  seller: { id: string; name: string; slug: string };
  _count: { sellpages: number };
}

interface StoresResponse {
  data: StoreApiRow[];
  total: number;
  page: number;
  limit: number;
}

// Unified row type for the table
interface StoreRow {
  id: string;
  domain: string;
  sellerName: string;
  sellerId: string;
  status: string;
  isDefault: boolean;
  productCount: number;
  sellpageCount: number;
  monthlyVolume: number;
  createdAt: string;
}

const ALL_STATUSES = ['All', 'ACTIVE', 'PENDING', 'INACTIVE'];

export default function AdminStoresPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState('All');
  const [search, setSearch] = useState('');

  // Build API path
  const apiPath = useMemo(() => {
    if (IS_PREVIEW) return null;
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (statusTab !== 'All') params.set('status', statusTab);
    if (search.trim()) params.set('search', search.trim());
    return `/admin/stores?${params.toString()}`;
  }, [statusTab, search]);

  const { data: apiData, loading, error } = useAdminApi<StoresResponse>(apiPath);

  // Map API data to unified row type
  const allStores: StoreRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return MOCK_STORES as StoreRow[];
    }
    if (!apiData?.data) return [];
    return apiData.data.map((s) => ({
      id: s.id,
      domain: s.hostname,
      sellerName: s.seller?.name ?? '',
      sellerId: s.seller?.id ?? '',
      status: s.status,
      isDefault: s.isPrimary,
      productCount: 0,
      sellpageCount: s._count.sellpages,
      monthlyVolume: 0,
      createdAt: s.createdAt,
    }));
  }, [apiData]);

  // Client-side filtering for preview mode
  const filtered = useMemo(() => {
    if (!IS_PREVIEW) return allStores;
    let data = statusTab === 'All' ? allStores : allStores.filter((s) => s.status === statusTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) => s.domain.toLowerCase().includes(q) || s.sellerName.toLowerCase().includes(q),
      );
    }
    return data;
  }, [allStores, statusTab, search]);

  // Counts for tabs
  const counts = useMemo(() => {
    const src = IS_PREVIEW ? (MOCK_STORES as StoreRow[]) : allStores;
    return {
      All: src.length,
      ACTIVE: src.filter((s) => s.status === 'ACTIVE').length,
      PENDING: src.filter((s) => s.status === 'PENDING').length,
      INACTIVE: src.filter((s) => s.status === 'INACTIVE').length,
    };
  }, [allStores]);

  const columns: Column<StoreRow>[] = [
    {
      key: 'domain',
      label: 'Domain',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground font-mono">{r.domain}</p>
          {r.isDefault && (
            <span className="text-[10px] text-amber-400 font-medium">Default</span>
          )}
        </div>
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
      key: 'sellpageCount',
      label: 'Sellpages',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">{num(r.sellpageCount)}</span>
      ),
    },
    {
      key: 'monthlyVolume',
      label: 'Monthly Vol.',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">
          {r.monthlyVolume > 0 ? `$${r.monthlyVolume.toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      className: 'text-right',
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <PageShell
      icon={<Globe size={20} className="text-amber-400" />}
      title="Stores & Domains"
      subtitle="All seller storefronts and domain assignments"
      actions={
        <Link
          href="/admin/stores/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg text-sm transition-colors"
        >
          <Plus size={16} />
          Add Store
        </Link>
      }
    >
      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
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
            <span className="ml-1 text-muted-foreground">
              {counts[s as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search domain or seller…"
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
        emptyMessage="No stores found."
        onRowClick={(r) => router.push(`/admin/stores/${r.id}`)}
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
