'use client';

import { CreditCard } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { KpiCard } from '@/components/KpiCard';
import { MOCK_PAYMENT_GATEWAYS, MOCK_SELLERS, type MockPaymentGateway } from '@/mock/admin';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function typeBadge(type: MockPaymentGateway['type']) {
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

function envBadge(env: MockPaymentGateway['environment']) {
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

function statusDot(status: MockPaymentGateway['status']) {
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
  const activeCount = MOCK_PAYMENT_GATEWAYS.filter((g) => g.status === 'ACTIVE').length;
  const uniqueSellers = new Set(MOCK_PAYMENT_GATEWAYS.flatMap((g) => g.assignedSellers)).size;

  return (
    <PageShell
      icon={<CreditCard size={20} className="text-amber-400" />}
      title="Payment Gateways"
      backHref="/admin/settings"
      backLabel="Settings"
    >
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Gateways" value={MOCK_PAYMENT_GATEWAYS.length} />
        <KpiCard label="Active" value={activeCount} />
        <KpiCard label="Assigned Sellers" value={uniqueSellers} />
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
              {MOCK_PAYMENT_GATEWAYS.map((gw) => (
                <tr
                  key={gw.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/20"
                >
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{gw.name}</td>
                  <td className="px-4 py-3">{typeBadge(gw.type)}</td>
                  <td className="px-4 py-3">{envBadge(gw.environment)}</td>
                  <td className="px-4 py-3">{statusDot(gw.status)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {gw.assignedSellers.length > 0 ? gw.assignedSellers.join(', ') : 'None'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground text-right">{gw.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Gateway Form (Preview) */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">API Key</label>
            <input className={inputCls} disabled placeholder="••••••••" type="password" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Secret Key</label>
            <input className={inputCls} disabled placeholder="••••••••" type="password" />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground block mb-2">Assign Sellers</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MOCK_SELLERS.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
              >
                <input type="checkbox" disabled className="rounded border-border" />
                {s.name}
              </label>
            ))}
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
