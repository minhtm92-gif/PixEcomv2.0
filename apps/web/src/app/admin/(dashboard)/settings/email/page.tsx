'use client';

import { Mail } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function SettingsEmailPage() {
  return (
    <PageShell
      icon={<Mail size={20} className="text-amber-400" />}
      title="Email Settings"
      subtitle="Transactional email provider, templates, and sender info"
    >
      <div className="max-w-2xl space-y-6">
        {/* SMTP */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">SMTP Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select className={inputCls} defaultValue="sendgrid">
                <option value="sendgrid">SendGrid</option>
                <option value="mailgun">Mailgun</option>
                <option value="ses">Amazon SES</option>
                <option value="smtp">Custom SMTP</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">API Key</label>
              <input className={inputCls} type="password" defaultValue="SG.****************************" readOnly />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From Name</label>
              <input className={inputCls} defaultValue="PixEcom" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From Email</label>
              <input className={inputCls} defaultValue="noreply@pixelxlab.com" type="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reply-To Email</label>
            <input className={inputCls} defaultValue="support@pixelxlab.com" type="email" />
          </div>
        </div>

        {/* Email Templates */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">Email Templates</h2>
          {[
            { name: 'Order Confirmation', status: 'Active' },
            { name: 'Shipping Notification', status: 'Active' },
            { name: 'Order Delivered', status: 'Active' },
            { name: 'Seller Welcome', status: 'Active' },
            { name: 'Password Reset', status: 'Active' },
            { name: 'Invoice', status: 'Draft' },
          ].map((t) => (
            <div key={t.name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-sm text-foreground">{t.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.status === 'Active'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t.status}
                </span>
                <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors opacity-60 cursor-default">
                  Edit
                </button>
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
