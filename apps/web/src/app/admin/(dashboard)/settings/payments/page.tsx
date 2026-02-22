'use client';

import { CreditCard } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function SettingsPaymentsPage() {
  return (
    <PageShell
      icon={<CreditCard size={20} className="text-amber-400" />}
      title="Payment Gateways"
      subtitle="Configure Stripe and PayPal integration keys"
    >
      <div className="max-w-2xl space-y-6">
        {/* Stripe */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Stripe</h2>
            <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-medium">Connected</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Publishable Key</label>
              <input className={inputCls} defaultValue="pk_live_****************************" readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Secret Key</label>
              <input className={inputCls} type="password" defaultValue="sk_live_****************************" readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Webhook Secret</label>
              <input className={inputCls} type="password" defaultValue="whsec_****************************" readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Platform Fee (%)</label>
              <input className={inputCls} defaultValue="2.5" type="number" min="0" max="20" step="0.5" />
            </div>
          </div>
        </div>

        {/* PayPal */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">PayPal</h2>
            <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs rounded-full font-medium">Connected</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Client ID</label>
              <input className={inputCls} defaultValue="AZDxjDSc****************************" readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Client Secret</label>
              <input className={inputCls} type="password" defaultValue="ELxjDSc*****************************" readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Environment</label>
              <select className={inputCls} defaultValue="live">
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="live">Live (Production)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors opacity-60 cursor-default">
            Save Changes (Preview)
          </button>
        </div>
      </div>
    </PageShell>
  );
}
