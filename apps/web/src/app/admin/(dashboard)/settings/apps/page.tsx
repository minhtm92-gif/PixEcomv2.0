'use client';

import { Puzzle, ExternalLink } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

const INTEGRATIONS = [
  {
    name: 'Facebook / Meta',
    description: 'Ads API, Pixel, and Conversions API integration',
    status: 'Connected',
    color: 'text-blue-400 bg-blue-500/15',
  },
  {
    name: 'Google Analytics',
    description: 'GA4 property integration for traffic analytics',
    status: 'Connected',
    color: 'text-green-400 bg-green-500/15',
  },
  {
    name: 'Shopify Import',
    description: 'Import products and orders from Shopify stores',
    status: 'Not Connected',
    color: 'text-muted-foreground bg-muted',
  },
  {
    name: 'Klaviyo',
    description: 'Email marketing automation and flows',
    status: 'Not Connected',
    color: 'text-muted-foreground bg-muted',
  },
  {
    name: 'Zapier',
    description: 'Connect PixEcom to 5000+ apps via Zapier',
    status: 'Not Connected',
    color: 'text-muted-foreground bg-muted',
  },
  {
    name: 'Slack',
    description: 'Get order alerts and notifications in Slack',
    status: 'Connected',
    color: 'text-purple-400 bg-purple-500/15',
  },
];

export default function SettingsAppsPage() {
  return (
    <PageShell
      icon={<Puzzle size={20} className="text-amber-400" />}
      title="Apps & Integrations"
      subtitle="Third-party app connections and webhook endpoints"
    >
      <div className="max-w-2xl space-y-6">
        {/* Integrations */}
        <div className="space-y-3">
          {INTEGRATIONS.map((app) => (
            <div
              key={app.name}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Puzzle size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{app.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${app.color}`}>
                  {app.status}
                </span>
                <button className="text-xs text-amber-400 hover:text-amber-300 opacity-60 cursor-default flex items-center gap-1">
                  {app.status === 'Connected' ? 'Manage' : 'Connect'}
                  <ExternalLink size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Webhooks */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">Webhook Endpoints</h2>
          <div className="space-y-3">
            {[
              { event: 'order.created', url: 'https://hooks.example.com/orders', active: true },
              { event: 'payment.captured', url: 'https://hooks.example.com/payments', active: true },
              { event: 'seller.approved', url: 'https://hooks.example.com/sellers', active: false },
            ].map((wh) => (
              <div key={wh.event} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.active ? 'bg-green-400' : 'bg-muted-foreground/30'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-amber-400">{wh.event}</p>
                  <p className="text-xs text-muted-foreground truncate">{wh.url}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Add Webhook URL</label>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="https://your-server.com/webhook" />
              <button className="px-3 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg opacity-60 cursor-default whitespace-nowrap">
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
