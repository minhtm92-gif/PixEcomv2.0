'use client';

import { Truck } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function SettingsFulfillmentPage() {
  return (
    <PageShell
      icon={<Truck size={20} className="text-amber-400" />}
      title="Fulfillment Settings"
      subtitle="Shipping carriers, warehouses, and fulfillment rules"
    >
      <div className="max-w-2xl space-y-6">
        {/* Default Carrier */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">Shipping Carriers</h2>
          <div className="space-y-3">
            {[
              { name: 'FedEx', enabled: true, tracking: 'Auto' },
              { name: 'UPS', enabled: true, tracking: 'Auto' },
              { name: 'USPS', enabled: false, tracking: 'Manual' },
              { name: 'DHL Express', enabled: true, tracking: 'Auto' },
            ].map((c) => (
              <div key={c.name} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Tracking: {c.tracking}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-10 h-5 rounded-full border relative cursor-default ${
                      c.enabled ? 'bg-amber-500/20 border-amber-500/40' : 'bg-muted border-border'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                        c.enabled ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-muted-foreground/50'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Processing Times */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">Processing Times</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min Processing Days</label>
              <input className={inputCls} type="number" defaultValue="1" min="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Max Processing Days</label>
              <input className={inputCls} type="number" defaultValue="3" min="1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Default Warehouse</label>
            <select className={inputCls} defaultValue="us-east">
              <option value="us-east">US East — New York, NY</option>
              <option value="us-west">US West — Los Angeles, CA</option>
              <option value="eu-central">EU Central — Frankfurt, DE</option>
            </select>
          </div>
        </div>

        {/* Auto-fulfillment */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">Auto-Fulfillment</h2>
          <div className="space-y-3">
            {[
              { label: 'Auto-confirm orders on payment success', enabled: true },
              { label: 'Auto-send tracking to customers', enabled: true },
              { label: 'Auto-mark delivered after 7 days shipped', enabled: false },
            ].map((opt) => (
              <div key={opt.label} className="flex items-center gap-3">
                <div
                  className={`w-10 h-5 rounded-full border relative cursor-default flex-shrink-0 ${
                    opt.enabled ? 'bg-amber-500/20 border-amber-500/40' : 'bg-muted border-border'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                      opt.enabled ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5 bg-muted-foreground/50'
                    }`}
                  />
                </div>
                <span className="text-sm text-foreground">{opt.label}</span>
              </div>
            ))}
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
