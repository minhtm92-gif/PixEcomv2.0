'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num } from '@/lib/format';
import { MOCK_ADMIN_PRODUCTS, type MockAdminProduct } from '@/mock/admin';

const ALL_STATUSES = ['All', 'ACTIVE', 'DRAFT', 'ARCHIVED'];

export default function AdminProductsPage() {
  const [statusTab, setStatusTab] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = MOCK_ADMIN_PRODUCTS.filter((p) => {
    const matchStatus = statusTab === 'All' || p.status === statusTab;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const columns: Column<MockAdminProduct>[] = [
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
      render: (r) => <span className="font-mono text-sm text-foreground">{moneyWhole(r.revenue)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      className: 'text-right',
      render: (r) => <span className="text-xs text-muted-foreground">{r.createdAt}</span>,
    },
  ];

  return (
    <PageShell
      icon={<ShoppingBag size={20} className="text-amber-400" />}
      title="Products"
      subtitle="All products across all sellers"
    >
      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
        {ALL_STATUSES.map((s) => {
          const count =
            s === 'All'
              ? MOCK_ADMIN_PRODUCTS.length
              : MOCK_ADMIN_PRODUCTS.filter((p) => p.status === s).length;
          return (
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
              <span className="ml-1 text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products, SKUs, sellers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={false}
        emptyMessage="No products found."
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
