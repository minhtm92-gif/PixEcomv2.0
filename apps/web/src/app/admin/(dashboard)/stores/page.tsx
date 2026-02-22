'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { num } from '@/lib/format';
import { MOCK_STORES, type MockStore } from '@/mock/admin';

const ALL_STATUSES = ['All', 'ACTIVE', 'PENDING', 'INACTIVE'];

export default function AdminStoresPage() {
  const [statusTab, setStatusTab] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = MOCK_STORES.filter((s) => {
    const matchStatus = statusTab === 'All' || s.status === statusTab;
    const q = search.toLowerCase();
    const matchSearch =
      !q || s.domain.toLowerCase().includes(q) || s.sellerName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const columns: Column<MockStore>[] = [
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
      key: 'productCount',
      label: 'Products',
      className: 'text-right',
      render: (r) => (
        <span className="font-mono text-sm text-foreground">{num(r.productCount)}</span>
      ),
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
      icon={<Globe size={20} className="text-amber-400" />}
      title="Stores & Domains"
      subtitle="All seller storefronts and domain assignments"
    >
      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
        {ALL_STATUSES.map((s) => {
          const count =
            s === 'All'
              ? MOCK_STORES.length
              : MOCK_STORES.filter((st) => st.status === s).length;
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
          placeholder="Search domain or seller…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={false}
        emptyMessage="No stores found."
        rowKey={(r) => r.id}
      />
    </PageShell>
  );
}
