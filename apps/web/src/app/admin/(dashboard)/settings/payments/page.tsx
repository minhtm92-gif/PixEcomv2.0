'use client';

import { useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { useAdminApi } from '@/hooks/useAdminApi';
import { MOCK_PAYMENT_GATEWAYS, MOCK_SELLERS, type MockPaymentGateway } from '@/mock/admin';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── API response types ──────────────────────────────────────────────────────

interface PaymentGatewayApi {
  id: string;
  name: string;
  type: string;
  status: string;
  environment: string;
  createdAt: string;
  _count: { sellers: number };
}

// Unified row type
interface GatewayRow {
  id: string;
  name: string;
  type: string;
  environment: string;
  status: string;
  assignedCount: number;
  createdAt: string;
}

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function typeBadge(type: string) {
  return type === 'stripe' ? (
    <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-400 text-xs rounded-full font-medium">
      Stripe
    </span>
  ) : (
    <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full font-medium">
      PayPal
    </span>
  );
}

function envBadge(env: string) {
  return env === 'live' ? (
    <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-medium">
      Live
    </span>
  ) : (
    <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded-full font-medium">
      Sandbox
    </span>
  );
}

function statusDot(status: string) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${
          status === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-400'
        }`}
      />
      {status === 'ACTIVE' ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function SettingsPaymentsPage() {
  const { data: apiGateways, loading, error } = useAdminApi<PaymentGatewayApi[]>(
    IS_PREVIEW ? null : '/admin/payment-gateways',
  );

  const gateways: GatewayRow[] = useMemo(() => {
    if (IS_PREVIEW) {
      return MOCK_PAYMENT_GATEWAYS.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        environment: g.environment,
        status: g.status,
        assignedCount: g.assignedSellers.length,
        createdAt: g.createdAt,
      }));
    }
    if (!apiGateways) return [];
    return apiGateways.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      environment: g.environment,
      status: g.status,
      assignedCount: g._count?.sellers ?? 0,
      createdAt: g.createdAt,
    }));
  }, [apiGateways]);

  const activeCount = gateways.filter((g) => g.status === 'ACTIVE').length;
  const totalAssigned = gateways.reduce((a, g) => a + g.assignedCount, 0);

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading payment gateways...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      icon={<CreditCard size={20} className="text-amber-400" />}
      title="Payment Gateways"
      backHref="/admin/settings"
      backLabel="Settings"
    >
      {!IS_PREVIEW && error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Gateways" value={gateways.length} />
        <KpiCard label="Active" value={activeCount} />
        <KpiCard label="Assigned Sellers" value={totalAssigned} />
      </div>

      {/* Gateways Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Environment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned Sellers</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {gateways.map((gw) => (
                <tr
                  key={gw.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/20"
                >
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{gw.name}</td>
                  <td className="px-4 py-3">{typeBadge(gw.type)}</td>
                  <td className="px-4 py-3">{envBadge(gw.environment)}</td>
                  <td className="px-4 py-3">{statusDot(gw.status)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                    {gw.assignedCount}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground text-right">
                    {new Date(gw.createdAt).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Gateway Form (placeholder) */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 border-b border-border pb-3">
          Add Gateway
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select className={inputCls} disabled defaultValue="">
              <option value="" disabled>Select type…</option>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input className={inputCls} disabled placeholder="e.g. Stripe Production" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Environment</label>
            <select className={inputCls} disabled defaultValue="">
              <option value="" disabled>Select environment…</option>
              <option value="live">Live</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            disabled
            className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg transition-colors opacity-50 cursor-not-allowed"
          >
            Save Gateway
          </button>
        </div>
      </div>
    </PageShell>
  );
}
