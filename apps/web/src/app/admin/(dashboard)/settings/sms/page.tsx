'use client';

import { MessageSquare } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function SettingsSmsPage() {
  return (
    <PageShell
      icon={<MessageSquare size={20} className="text-amber-400" />}
      title="SMS Settings"
      subtitle="SMS gateway, opt-in flows, and notification templates"
    >
      <div className="max-w-2xl space-y-6">
        {/* Provider */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">SMS Provider</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <select className={inputCls} defaultValue="twilio">
              <option value="twilio">Twilio</option>
              <option value="vonage">Vonage</option>
              <option value="aws-sns">Amazon SNS</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Account SID</label>
              <input className={inputCls} type="password" defaultValue="AC****************************" readOnly />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Auth Token</label>
              <input className={inputCls} type="password" defaultValue="****************************" readOnly />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">From Number</label>
            <input className={inputCls} defaultValue="+1 555-PIXEL-01" />
          </div>
        </div>

        {/* Templates */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">SMS Templates</h2>
          {[
            { name: 'Order Confirmation', enabled: true },
            { name: 'Shipping Update', enabled: true },
            { name: 'Delivery Confirmation', enabled: true },
            { name: 'Abandoned Checkout', enabled: false },
            { name: 'Promotional', enabled: false },
          ].map((t) => (
            <div key={t.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-sm text-foreground">{t.name}</span>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-5 rounded-full border relative cursor-default ${
                    t.enabled ? 'bg-amber-500/20 border-amber-500/40' : 'bg-muted border-border'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                      t.enabled ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-muted-foreground/50'
                    }`}
                  />
                </div>
              </div>
            </div>
          ))}
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
