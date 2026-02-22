'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, CreditCard, Globe, ShoppingBag, ClipboardList } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, fmtDate, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  MOCK_SELLERS, MOCK_STORES, MOCK_ADMIN_PRODUCTS, MOCK_ADMIN_ORDERS,
  type MockStore, type MockAdminProduct, type MockAdminOrder,
} from '@/mock/admin';

const inputCls = 'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

const MOCK_FB = [
  { id: 'fb1', name: 'TechGear Ad Account', type: 'AD_ACCOUNT', status: 'ACTIVE', externalId: 'act_123456789' },
  { id: 'fb2', name: 'TechGear Facebook Page', type: 'PAGE', status: 'ACTIVE', externalId: '987654321' },
  { id: 'fb3', name: 'TechGear Pixel', type: 'PIXEL', status: 'ACTIVE', externalId: 'px_111222333' },
];

const TABS = [
  { label: 'Profile & Payment', value: 'profile', icon: User },
  { label: 'FB Connections', value: 'fb', icon: Globe },
  { label: 'Stores', value: 'stores', icon: Globe },
  { label: 'Products', value: 'products', icon: ShoppingBag },
  { label: 'Orders', value: 'orders', icon: ClipboardList },
];

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState('profile');
  const [selectedGateway, setSelectedGateway] = useState('stripe');

  const seller = MOCK_SELLERS.find((s) => s.id === id);
  if (!seller) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/admin/sellers')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Sellers
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">Seller not found</div>
      </div>
    );
  }

  const sellerStores = MOCK_STORES.filter((s) => s.sellerId === seller.id);
  const sellerProducts = MOCK_ADMIN_PRODUCTS.filter((p) => p.sellerName === seller.name);
  const sellerOrders = MOCK_ADMIN_ORDERS.filter((o) => o.sellerId === seller.id);

  const storeColumns: Column<MockStore>[] = [
    { key: 'domain', label: 'Domain', render: (r) => <span className="font-mono text-sm text-foreground">{r.domain}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'products', label: 'Products', className: 'text-right', render: (r) => <span className="font-mono">{r.productCount}</span> },
    { key: 'default', label: 'Default', render: (r) => r.isDefault ? <span className="text-amber-400 text-xs font-medium">★ Default</span> : <span className="text-muted-foreground text-xs">—</span> },
    { key: 'created', label: 'Created', render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span> },
  ];

  const productColumns: Column<MockAdminProduct>[] = [
    { key: 'name', label: 'Name', render: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span> },
    { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.sku}</span> },
    { key: 'price', label: 'Price', className: 'text-right', render: (r) => <span className="font-mono">{moneyWhole(r.price)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'variants', label: 'Variants', className: 'text-right', render: (r) => <span className="font-mono">{r.variants}</span> },
    { key: 'created', label: 'Created', render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span> },
  ];

  const orderColumns: Column<MockAdminOrder>[] = [
    { key: 'orderNumber', label: 'Order #', render: (r) => <span className="font-mono text-sm text-foreground">{r.orderNumber}</span> },
    { key: 'customer', label: 'Customer', render: (r) => <span className="text-sm">{r.customer}</span> },
    { key: 'product', label: 'Product', render: (r) => <span className="text-sm truncate block max-w-[160px]">{r.product}</span> },
    { key: 'total', label: 'Total', className: 'text-right', render: (r) => <span className="font-mono">{moneyWhole(r.total)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'date', label: 'Date', render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <button onClick={() => router.push('/admin/sellers')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Sellers
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">{seller.name}</h1>
        <StatusBadge status={seller.status} />
        <button className="ml-auto px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors opacity-60 cursor-default">
          Edit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Profile & Payment */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User size={14} className="text-amber-400" /> Store Profile
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Store Name</label>
                <input type="text" defaultValue={seller.name} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Email</label>
                <input type="email" defaultValue={seller.email} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                <input type="text" defaultValue={seller.phone} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <select defaultValue={seller.status} className={inputCls}>
                  {['ACTIVE', 'PENDING', 'DEACTIVATED', 'REJECTED'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Created</label>
                <p className="text-sm text-foreground">{fmtDateTime(seller.createdAt)}</p>
              </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default w-full">
              Save Changes
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-amber-400" /> Payment Gateway
            </h2>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Current</p>
              {seller.paymentGateway ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  seller.paymentGateway === 'stripe' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-blue-500/15 text-blue-400'
                }`}>
                  {seller.paymentGateway === 'stripe' ? 'Stripe' : 'PayPal'}
                  {seller.stripeAccountId && ` — ${seller.stripeAccountId}`}
                  {seller.paypalEmail && ` — ${seller.paypalEmail}`}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not Assigned</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Assign Gateway</label>
                <select
                  value={selectedGateway}
                  onChange={(e) => setSelectedGateway(e.target.value)}
                  className={inputCls}
                >
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
              {selectedGateway === 'stripe' && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Stripe Account ID</label>
                  <input type="text" defaultValue={seller.stripeAccountId ?? ''} className={inputCls} placeholder="acct_..." />
                </div>
              )}
              {selectedGateway === 'paypal' && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">PayPal Email</label>
                  <input type="email" defaultValue={seller.paypalEmail ?? ''} className={inputCls} placeholder="paypal@email.com" />
                </div>
              )}
              <button className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default">
                Save Payment
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded p-2">
              Payment gateway is managed by admin. Seller cannot modify.
            </p>
          </div>
        </div>
      )}

      {/* Tab: FB Connections */}
      {tab === 'fb' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {['Name', 'Type', 'Status', 'External ID'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {MOCK_FB.map(fb => (
                <tr key={fb.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{fb.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{fb.type}</td>
                  <td className="px-4 py-3"><StatusBadge status={fb.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fb.externalId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Stores */}
      {tab === 'stores' && (
        sellerStores.length > 0
          ? <DataTable columns={storeColumns} data={sellerStores} loading={false} emptyMessage="No stores." rowKey={r => r.id} />
          : <p className="text-sm text-muted-foreground">No stores for this seller.</p>
      )}

      {/* Tab: Products */}
      {tab === 'products' && (
        sellerProducts.length > 0
          ? <DataTable columns={productColumns} data={sellerProducts} loading={false} emptyMessage="No products." rowKey={r => r.id} />
          : <p className="text-sm text-muted-foreground">No products for this seller.</p>
      )}

      {/* Tab: Orders */}
      {tab === 'orders' && (
        sellerOrders.length > 0
          ? <DataTable columns={orderColumns} data={sellerOrders} loading={false} emptyMessage="No orders." rowKey={r => r.id} />
          : <p className="text-sm text-muted-foreground">No orders for this seller.</p>
      )}
    </div>
  );
}
