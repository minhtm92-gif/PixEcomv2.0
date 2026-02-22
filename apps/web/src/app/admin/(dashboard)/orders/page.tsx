'use client';

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole } from '@/lib/format';
import { MOCK_ADMIN_ORDERS, type MockAdminOrder } from '@/mock/admin';

const ALL_STATUSES = ['All', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = MOCK_ADMIN_ORDERS.filter((o) => {
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

  const columns: Column<MockAdminOrder>[] = [
    {
      key: 'orderNumber',
      label: 'Order #',
      render: (r) => (
        <span className="font-mono text-sm font-medium text-foreground">{r.orderNumber}</span>
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
      render: (r) => <span className="text-xs text-muted-foreground">{r.createdAt}</span>,
    },
  ];

  return (
    <PageShell
      icon={<ClipboardList size={20} className="text-amber-400" />}
      title="Orders"
      subtitle="All platform orders across sellers"
    >
      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit flex-wrap">
        {ALL_STATUSES.map((s) => {
          const count =
            s === 'All'
              ? MOCK_ADMIN_ORDERS.length
              : MOCK_ADMIN_ORDERS.filter((o) => o.status === s).length;
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
          placeholder="Search orders, customers, sellers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={false}
        emptyMessage="No orders found."
        onRowClick={(r) => router.push(`/admin/orders/${r.id}`)}
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
