'use client';

import { Receipt } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { moneyWhole, num } from '@/lib/format';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

const PLANS = [
  {
    name: 'Starter',
    price: 29,
    sellers: 2,
    monthlyRevenue: 10000,
    commission: 3.5,
    features: ['2 seller accounts', 'Up to $10K/mo revenue', 'Basic analytics', 'Email support'],
  },
  {
    name: 'Growth',
    price: 79,
    sellers: 10,
    monthlyRevenue: 50000,
    commission: 2.5,
    features: ['10 seller accounts', 'Up to $50K/mo revenue', 'Advanced analytics', 'Priority support', 'Custom domains'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 299,
    sellers: 999,
    monthlyRevenue: 999999,
    commission: 1.5,
    features: ['Unlimited sellers', 'Unlimited revenue', 'Full analytics suite', 'Dedicated support', 'White-label', 'SLA guarantee'],
  },
];

const RECENT_INVOICES = [
  { id: 'INV-2026-02', date: '2026-02-01', amount: 79, status: 'Paid' },
  { id: 'INV-2026-01', date: '2026-01-01', amount: 79, status: 'Paid' },
  { id: 'INV-2025-12', date: '2025-12-01', amount: 29, status: 'Paid' },
];

export default function SettingsBillingPage() {
  return (
    <PageShell
      icon={<Receipt size={20} className="text-amber-400" />}
      title="Billing & Plans"
      subtitle="Subscription plans, seller fees, and invoicing"
    >
      {/* Current plan */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Current Plan: <span className="text-amber-400">Growth</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Renews February 1, 2027 · {moneyWhole(79)}/mo</p>
        </div>
        <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors opacity-60 cursor-default">
          Manage
        </button>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`bg-card border rounded-xl p-5 relative ${
              plan.popular ? 'border-amber-500/50' : 'border-border'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full">
                POPULAR
              </span>
            )}
            <h3 className="text-sm font-bold text-foreground mb-1">{plan.name}</h3>
            <p className="text-2xl font-bold text-foreground font-mono mb-1">
              {moneyWhole(plan.price)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {plan.sellers >= 999 ? 'Unlimited' : num(plan.sellers)} sellers ·{' '}
              {plan.commission}% commission
            </p>
            <ul className="space-y-1.5 mb-4">
              {plan.features.map((f) => (
                <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="text-amber-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-2 rounded-lg text-xs font-medium transition-colors opacity-60 cursor-default ${
                plan.popular
                  ? 'bg-amber-500 text-black'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {plan.popular ? 'Current Plan' : 'Switch Plan'}
            </button>
          </div>
        ))}
      </div>

      {/* Fee config */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4 mb-6">
        <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">Platform Fee Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Transaction Fee (%)</label>
            <input className={inputCls} type="number" defaultValue="2.5" step="0.5" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Payout Schedule</label>
            <select className={inputCls} defaultValue="weekly">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3 mb-3">Recent Invoices</h2>
        <div className="space-y-2">
          {RECENT_INVOICES.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-mono text-foreground">{inv.id}</p>
                <p className="text-xs text-muted-foreground">{inv.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-foreground">{moneyWhole(inv.amount)}</span>
                <span className="text-xs bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">{inv.status}</span>
                <button className="text-xs text-amber-400 hover:text-amber-300 opacity-60 cursor-default">PDF</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
