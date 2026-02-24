'use client';

import { useState, useMemo } from 'react';
import { ShoppingBag, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, fmtDate } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_ADMIN_PRODUCTS, type MockAdminProduct } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response type ───────────────────────────────────────────────────────

interface ProductApiRow {
  id: string;
  productCode: string;
  name: string;
  slug: string;
  basePrice: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  currency: string;
  sku: string | null;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count: { variants: number; sellpages: number; orderItems: number };
}

interface ProductsResponse {
  data: ProductApiRow[];
  total: number;
  page: number;
  limit: number;
}

// Unified row type for the table
interface ProductRow {
  id: string;
  name: string;
  sku: string;
  makerName: string;
  price: number;
  status: string;
  variants: number;
  orders: number;
  revenue: number;
  roas: number;
  createdAt: string;
}

const ALL_STATUSES = ['All', 'ACTIVE', 'DRAFT', 'ARCHIVED'];

export default function AdminProductsPage() {
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
    return `/admin/products?${params.toString()}`;
  }, [statusTab, search]);

  const { data: apiData, loading, error } = useAdminApi<ProductsResponse>(apiPath);

  // Map API data to unified row type
  const allProducts: ProductRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return MOCK_ADMIN_PRODUCTS as ProductRow[];
    }
    if (!apiData?.data) return [];
    return apiData.data.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? p.productCode,
      makerName: p.productCode,
      price: Number(p.basePrice),
      status: p.status,
      variants: p._count.variants,
      orders: p._count.orderItems,
      revenue: 0,
      roas: 0,
      createdAt: p.createdAt,
    }));
  }, [apiData]);

  // Client-side filtering for preview mode
  const filtered = useMemo(() => {
    if (!IS_PREVIEW) return allProducts;
    let data = statusTab === 'All' ? allProducts : allProducts.filter((p) => p.status === statusTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.makerName.toLowerCase().includes(q),
      );
    }
    return data;
  }, [allProducts, statusTab, search]);

  // Counts for tabs
  const counts = useMemo(() => {
    const src = IS_PREVIEW ? (MOCK_ADMIN_PRODUCTS as ProductRow[]) : allProducts;
    return {
      All: src.length,
      ACTIVE: src.filter((p) => p.status === 'ACTIVE').length,
      DRAFT: src.filter((p) => p.status === 'DRAFT').length,
      ARCHIVED: src.filter((p) => p.status === 'ARCHIVED').length,
    };
  }, [allProducts]);

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      label: 'Product',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{r.sku}</p>
        </div>
      ),
    },
    {
      key: 'makerName',
      label: IS_PREVIEW ? 'Maker' : 'Code',
      render: (r) => <span className="text-sm text-muted-foreground">{r.makerName}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'price',
      label: 'Price',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm text-foreground">{moneyWhole(r.price)}</span>,
    },
    {
      key: 'variants',
      label: 'Variants',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm text-foreground">{num(r.variants)}</span>,
    },
    {
      key: 'orders',
      label: 'Orders',
      className: 'text-right',
      render: (r) => <span className="font-mono text-sm text-foreground">{num(r.orders)}</span>,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">
          {r.revenue > 0 ? moneyWhole(r.revenue) : '—'}
        </span>
      ),
    },
    {
      key: 'roas',
      label: 'ROAS',
      className: 'text-right',
      render: (r) => (
        <span
          className={`font-mono text-sm ${
            r.roas === 0
              ? 'text-muted-foreground'
              : r.roas >= 3
                ? 'text-green-400'
                : r.roas >= 2
                  ? 'text-amber-400'
                  : 'text-red-400'
          }`}
        >
          {r.roas === 0 ? '—' : r.roas.toFixed(1)}
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
      icon={<ShoppingBag size={20} className="text-amber-400" />}
      title="Products"
      subtitle="All products across all sellers"
      actions={
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg text-sm transition-colors"
        >
          <Plus size={16} />
          Add Product
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
          placeholder="Search products, SKUs, makers…"
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
        emptyMessage="No products found."
        onRowClick={(r) => router.push(`/admin/products/${r.id}`)}
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
