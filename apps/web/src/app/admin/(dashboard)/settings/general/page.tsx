'use client';

import { Globe } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

export default function SettingsGeneralPage() {
  return (
    <PageShell
      icon={<Globe size={20} className="text-amber-400" />}
      title="General Settings"
      subtitle="Platform name, timezone, language, and branding"
    >
      <div className="max-w-2xl space-y-6">
        {/* Platform Identity */}
        <Section title="Platform Identity">
          <Field label="Platform Name">
            <input className={inputCls} defaultValue="PixEcom" />
          </Field>
          <Field label="Support Email">
            <input className={inputCls} defaultValue="support@pixelxlab.com" type="email" />
          </Field>
          <Field label="Platform URL">
            <input className={inputCls} defaultValue="https://pixelxlab.com" type="url" />
          </Field>
        </Section>

        {/* Localization */}
        <Section title="Localization">
          <Field label="Default Timezone">
            <select className={inputCls} defaultValue="UTC">
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT)</option>
            </select>
          </Field>
          <Field label="Default Language">
            <select className={inputCls} defaultValue="en">
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
              <option value="es">Spanish</option>
            </select>
          </Field>
          <Field label="Currency">
            <select className={inputCls} defaultValue="USD">
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="VND">VND — Vietnamese Dong</option>
            </select>
          </Field>
        </Section>

        {/* Maintenance */}
        <Section title="Maintenance">
          <Field label="Maintenance Mode">
            <div className="flex items-center gap-3">
              <div className="w-10 h-5 rounded-full bg-muted border border-border relative cursor-pointer">
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-muted-foreground/50 transition-transform" />
              </div>
              <span className="text-sm text-muted-foreground">Off — platform is live</span>
            </div>
          </Field>
        </Section>

        <SaveButton />
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SaveButton() {
  return (
    <div className="flex justify-end">
      <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors opacity-60 cursor-default">
        Save Changes (Preview)
      </button>
    </div>
  );
}
