'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Copy } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  MOCK_STORES,
  MOCK_SELLERS,
  MOCK_ADMIN_PRODUCTS,
  type MockAdminProduct,
} from '@/mock/admin';

const TABS = [
  { label: 'Domain Info', value: 'domain' },
  { label: 'Seller', value: 'seller' },
  { label: 'Products', value: 'products' },
  { label: 'Sellpages', value: 'sellpages' },
];

export default function StoreDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState('domain');

  const store = MOCK_STORES.find((s) => s.id === id) ?? MOCK_STORES[0];

  if (!store) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/admin/stores')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Stores
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          Store not found
        </div>
      </div>
    );
  }

  const seller = MOCK_SELLERS.find((s) => s.id === store.sellerId);
  // In preview mode, show a subset of products as a stand-in for this store's products
  const sellerProducts = MOCK_ADMIN_PRODUCTS.slice(0, 4);

  const productColumns: Column<MockAdminProduct>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
    },
    {
      key: 'sku',
      label: 'SKU',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      className: 'text-right',
      render: (r) => <span className="font-mono">{moneyWhole(r.price)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'orders',
      label: 'Orders',
      className: 'text-right',
      render: (r) => <span className="font-mono">{num(r.orders)}</span>,
    },
    {
      key: 'created',
      label: 'Created',
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => router.push('/admin/stores')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Stores
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Globe size={20} className="text-amber-400" />
          {store.domain}
        </h1>
        <StatusBadge status={store.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Domain Info */}
      {tab === 'domain' && (
        <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-semibold text-foreground mb-4">Domain Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Domain</label>
              <p className="text-sm font-mono text-foreground">{store.domain}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Status</label>
              <StatusBadge status={store.status} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Verification Method</label>
              <p className="text-sm text-foreground">
                {store.verificationMethod === 'TXT' ? 'TXT Record' : 'A Record'}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Verification Token</label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
                  {store.verificationToken}
                </code>
                <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Is Primary</label>
              {store.isDefault ? (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                  Yes
                </span>
              ) : (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400">
                  No
                </span>
              )}
            </div>
          </div>

          {/* DNS Instructions */}
          <div className="bg-muted rounded-lg p-4 border border-border mt-4">
            <p className="text-sm font-medium text-foreground mb-2">DNS Instructions</p>
            {store.verificationMethod === 'TXT' ? (
              <p className="text-sm text-muted-foreground">
                Add a TXT record to your DNS:{' '}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded text-foreground">
                  {store.verificationToken}
                </code>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add an A record pointing to:{' '}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded text-foreground">
                  76.76.21.21
                </code>
              </p>
            )}
          </div>

          <button
            disabled
            className="mt-4 w-full py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default"
          >
            Verify Domain
          </button>
        </div>
      )}

      {/* Tab: Seller */}
      {tab === 'seller' && (
        <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-semibold text-foreground mb-4">Seller Information</h2>
          {seller ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <p className="text-sm text-foreground font-medium">{seller.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Email</label>
                <p className="text-sm text-foreground">{seller.email}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <StatusBadge status={seller.status} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Stores</label>
                <p className="text-sm font-mono text-foreground">{num(seller.stores)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Revenue</label>
                <p className="text-sm font-mono text-foreground">{moneyWhole(seller.revenue)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seller not found.</p>
          )}
        </div>
      )}

      {/* Tab: Products */}
      {tab === 'products' && (
        sellerProducts.length > 0 ? (
          <DataTable
            columns={productColumns}
            data={sellerProducts}
            loading={false}
            emptyMessage="No products."
            rowKey={(r) => r.id}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No products for this store&apos;s seller.</p>
        )
      )}

      {/* Tab: Sellpages */}
      {tab === 'sellpages' && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground text-center py-8">
            Sellpages for this domain will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
