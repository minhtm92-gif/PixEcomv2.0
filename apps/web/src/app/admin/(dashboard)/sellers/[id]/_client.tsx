'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, CreditCard, Globe, ShoppingBag, ClipboardList, KeyRound } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, num, fmtDate, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAdminApi } from '@/hooks/useAdminApi';
import { apiPatch, apiPost } from '@/lib/apiClient';
import {
  MOCK_SELLERS, MOCK_STORES, MOCK_ADMIN_PRODUCTS, MOCK_ADMIN_ORDERS,
  type MockStore, type MockAdminProduct, type MockAdminOrder,
} from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

const inputCls = 'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

// ── API response type ───────────────────────────────────────────────────────

interface SellerDetailApi {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    supportEmail: string | null;
  } | null;
  domains: Array<{
    id: string;
    hostname: string;
    status: string;
    isPrimary: boolean;
    createdAt: string;
  }>;
  paypalGateway: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
  creditCardGateway: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
  sellerUsers: Array<{
    role: string;
    user: {
      id: string;
      email: string;
      displayName: string | null;
      role: string;
    };
  }>;
  _count: {
    orders: number;
    sellpages: number;
    campaigns: number;
  };
}

// Unified types for sub-tables
interface DomainRow {
  id: string;
  domain: string;
  status: string;
  productCount: number;
  isDefault: boolean;
  createdAt: string;
}

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
  const [selectedPaypal, setSelectedPaypal] = useState('');
  const [selectedCreditCard, setSelectedCreditCard] = useState('');
  const [savingPaypal, setSavingPaypal] = useState(false);
  const [savingCreditCard, setSavingCreditCard] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // API calls
  const { data: apiSeller, loading, error } = useAdminApi<SellerDetailApi>(
    IS_PREVIEW ? null : `/admin/sellers/${id}`,
    [refreshKey],
  );

  // Fetch available gateways
  const { data: apiGateways } = useAdminApi<{ id: string; name: string; type: string; status: string }[]>(
    IS_PREVIEW ? null : '/admin/payment-gateways',
  );

  // Preview mode: find mock seller
  const mockSeller = IS_PREVIEW ? MOCK_SELLERS.find((s) => s.id === id) : null;

  // Resolve seller data (must stay before any early returns — Rules of Hooks)
  const sellerName = IS_PREVIEW ? mockSeller?.name : apiSeller?.name;
  const sellerStatus = IS_PREVIEW ? mockSeller?.status : apiSeller?.status;
  const sellerEmail = IS_PREVIEW
    ? mockSeller?.email
    : apiSeller?.sellerUsers?.[0]?.user?.email ?? '';
  const sellerPhone = IS_PREVIEW ? mockSeller?.phone : '';
  const sellerCreatedAt = IS_PREVIEW ? mockSeller?.createdAt : apiSeller?.createdAt;
  const currentPaypal = IS_PREVIEW ? null : apiSeller?.paypalGateway ?? null;
  const currentCreditCard = IS_PREVIEW ? null : apiSeller?.creditCardGateway ?? null;

  // Filter gateways by category
  const paypalGateways = (apiGateways ?? []).filter(
    (g) => g.status === 'ACTIVE' && ['paypal', 'paypal_pro'].includes(g.type),
  );
  const creditCardGateways = (apiGateways ?? []).filter(
    (g) => g.status === 'ACTIVE' && !['paypal', 'paypal_pro'].includes(g.type),
  );

  // Sub-data (useMemo must be called unconditionally — Rules of Hooks)
  const sellerStores: DomainRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return (MOCK_STORES.filter((s) => s.sellerId === mockSeller?.id) as unknown as DomainRow[]).map((s: any) => ({
        id: s.id,
        domain: s.domain,
        status: s.status,
        productCount: s.productCount ?? 0,
        isDefault: s.isDefault ?? false,
        createdAt: s.createdAt,
      }));
    }
    return (apiSeller?.domains ?? []).map((d) => ({
      id: d.id,
      domain: d.hostname,
      status: d.status,
      productCount: 0,
      isDefault: d.isPrimary,
      createdAt: d.createdAt,
    }));
  }, [apiSeller, mockSeller]);

  const sellerProducts = IS_PREVIEW
    ? MOCK_ADMIN_PRODUCTS.filter((p) => p.makerName === mockSeller?.name || p.makerName === 'Admin (PixEcom)')
    : [];

  const sellerOrders = IS_PREVIEW
    ? MOCK_ADMIN_ORDERS.filter((o) => o.sellerId === mockSeller?.id)
    : [];

  // Handlers
  const handleSavePaypal = useCallback(async () => {
    if (!selectedPaypal || !id) return;
    setSavingPaypal(true);
    try {
      await apiPatch(`/admin/sellers/${id}`, { paypalGatewayId: selectedPaypal });
      setRefreshKey((k) => k + 1);
    } catch { /* ignore */ }
    setSavingPaypal(false);
  }, [selectedPaypal, id]);

  const handleSaveCreditCard = useCallback(async () => {
    if (!selectedCreditCard || !id) return;
    setSavingCreditCard(true);
    try {
      await apiPatch(`/admin/sellers/${id}`, { creditCardGatewayId: selectedCreditCard });
      setRefreshKey((k) => k + 1);
    } catch { /* ignore */ }
    setSavingCreditCard(false);
  }, [selectedCreditCard, id]);

  const handleResetPassword = useCallback(async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      setResetPwMsg('Password must be at least 6 characters');
      return;
    }
    setResetPwLoading(true);
    setResetPwMsg('');
    try {
      await apiPost(`/admin/sellers/${id}/reset-password`, { newPassword });
      setResetPwMsg('Password reset successfully!');
      setNewPassword('');
      setTimeout(() => { setResetPwOpen(false); setResetPwMsg(''); }, 2000);
    } catch (err: unknown) {
      setResetPwMsg(err instanceof Error ? err.message : 'Failed to reset password');
    }
    setResetPwLoading(false);
  }, [newPassword, id]);

  // Loading state
  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading seller details...</p>
        </div>
      </div>
    );
  }

  // Error / not found
  if (!IS_PREVIEW && error) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/admin/sellers')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Sellers
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">{error}</div>
      </div>
    );
  }

  if (IS_PREVIEW && !mockSeller) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/admin/sellers')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Sellers
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">Seller not found</div>
      </div>
    );
  }

  if (!IS_PREVIEW && !apiSeller) return null;

  const storeColumns: Column<DomainRow>[] = [
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
        <h1 className="text-xl font-bold text-foreground">{sellerName}</h1>
        <StatusBadge status={sellerStatus ?? ''} />
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
                <input type="text" defaultValue={sellerName ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Email</label>
                <input type="email" defaultValue={sellerEmail ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Phone</label>
                <input type="text" defaultValue={sellerPhone ?? ''} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Status</label>
                <select defaultValue={sellerStatus ?? ''} className={inputCls}>
                  {['ACTIVE', 'PENDING', 'DEACTIVATED', 'REJECTED'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Created</label>
                <p className="text-sm text-foreground">{sellerCreatedAt ? fmtDateTime(sellerCreatedAt) : '—'}</p>
              </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium opacity-60 cursor-default w-full">
              Save Changes
            </button>
          </div>

          {/* PayPal Gateway */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-blue-400" /> PayPal
            </h2>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Current</p>
              {currentPaypal?.name ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                  {currentPaypal.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not Assigned</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Assign PayPal Gateway</label>
                <select
                  value={selectedPaypal || currentPaypal?.id || ''}
                  onChange={(e) => setSelectedPaypal(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select PayPal gateway —</option>
                  {paypalGateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.type})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSavePaypal}
                disabled={savingPaypal || !selectedPaypal}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPaypal ? 'Saving...' : 'Save PayPal'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded p-2">
              PayPal gateway is managed by admin. Seller cannot modify.
            </p>
          </div>

          {/* Credit Card Gateway */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-amber-400" /> Credit Card
            </h2>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Current</p>
              {currentCreditCard?.name ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400">
                  {currentCreditCard.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not Assigned</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Assign Credit Card Provider</label>
                <select
                  value={selectedCreditCard || currentCreditCard?.id || ''}
                  onChange={(e) => setSelectedCreditCard(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select provider —</option>
                  {creditCardGateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.type})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveCreditCard}
                disabled={savingCreditCard || !selectedCreditCard}
                className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCreditCard ? 'Saving...' : 'Save Credit Card'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded p-2">
              Credit card provider is managed by admin. Seller cannot modify.
            </p>
          </div>

          {/* Reset Password */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <KeyRound size={14} className="text-amber-400" /> Account Security
            </h2>
            {!resetPwOpen ? (
              <button
                onClick={() => setResetPwOpen(true)}
                className="w-full px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
              >
                Reset Seller Password
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputCls}
                    placeholder="Min 6 characters..."
                  />
                </div>
                {resetPwMsg && (
                  <p className={`text-xs ${resetPwMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                    {resetPwMsg}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setResetPwOpen(false); setNewPassword(''); setResetPwMsg(''); }}
                    className="flex-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetPwLoading}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {resetPwLoading ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}
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
        IS_PREVIEW ? (
          sellerProducts.length > 0
            ? <DataTable columns={productColumns} data={sellerProducts} loading={false} emptyMessage="No products." rowKey={r => r.id} />
            : <p className="text-sm text-muted-foreground">No products for this seller.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Products: {apiSeller?._count.sellpages ?? 0} sellpages, {apiSeller?._count.orders ?? 0} orders
          </p>
        )
      )}

      {/* Tab: Orders */}
      {tab === 'orders' && (
        IS_PREVIEW ? (
          sellerOrders.length > 0
            ? <DataTable columns={orderColumns} data={sellerOrders} loading={false} emptyMessage="No orders." rowKey={r => r.id} />
            : <p className="text-sm text-muted-foreground">No orders for this seller.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Total orders: {apiSeller?._count.orders ?? 0}
          </p>
        )
      )}
    </div>
  );
}
