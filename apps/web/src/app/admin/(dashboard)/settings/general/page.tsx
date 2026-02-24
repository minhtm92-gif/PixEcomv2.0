'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useAdminApi, useAdminMutation } from '@/hooks/useAdminApi';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

// ── API response type ───────────────────────────────────────────────────────

interface PlatformSettings {
  id: string;
  platformName: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultLanguage: string;
  supportEmail: string | null;
  logoUrl: string | null;
}

export default function SettingsGeneralPage() {
  const { data: apiSettings, loading, error } = useAdminApi<PlatformSettings>(
    IS_PREVIEW ? null : '/admin/settings',
  );
  const { mutate: save, loading: saving, error: saveError } = useAdminMutation<PlatformSettings>(
    '/admin/settings',
    'PATCH',
  );

  const [form, setForm] = useState({
    platformName: 'PixEcom',
    supportEmail: 'support@pixelxlab.com',
    defaultTimezone: 'UTC',
    defaultLanguage: 'en',
    defaultCurrency: 'USD',
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (apiSettings) {
      setForm({
        platformName: apiSettings.platformName ?? 'PixEcom',
        supportEmail: apiSettings.supportEmail ?? '',
        defaultTimezone: apiSettings.defaultTimezone ?? 'UTC',
        defaultLanguage: apiSettings.defaultLanguage ?? 'en',
        defaultCurrency: apiSettings.defaultCurrency ?? 'USD',
      });
    }
  }, [apiSettings]);

  const handleSave = async () => {
    if (IS_PREVIEW) return;
    try {
      await save(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error is set by hook
    }
  };

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      icon={<Globe size={20} className="text-amber-400" />}
      title="General Settings"
      subtitle="Platform name, timezone, language, and branding"
      backHref="/admin/settings"
      backLabel="Settings"
    >
      {!IS_PREVIEW && error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Platform Identity */}
        <Section title="Platform Identity">
          <Field label="Platform Name">
            <input
              className={inputCls}
              value={form.platformName}
              onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))}
            />
          </Field>
          <Field label="Support Email">
            <input
              className={inputCls}
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
              type="email"
            />
          </Field>
        </Section>

        {/* Localization */}
        <Section title="Localization">
          <Field label="Default Timezone">
            <select
              className={inputCls}
              value={form.defaultTimezone}
              onChange={(e) => setForm((f) => ({ ...f, defaultTimezone: e.target.value }))}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (ICT)</option>
            </select>
          </Field>
          <Field label="Default Language">
            <select
              className={inputCls}
              value={form.defaultLanguage}
              onChange={(e) => setForm((f) => ({ ...f, defaultLanguage: e.target.value }))}
            >
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
              <option value="es">Spanish</option>
            </select>
          </Field>
          <Field label="Currency">
            <select
              className={inputCls}
              value={form.defaultCurrency}
              onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="VND">VND — Vietnamese Dong</option>
            </select>
          </Field>
        </Section>

        {/* Save */}
        {saveError && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {saveError}
          </div>
        )}
        {saved && (
          <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            Settings saved successfully!
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={IS_PREVIEW || saving}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : IS_PREVIEW ? 'Save Changes (Preview)' : 'Save Changes'}
          </button>
        </div>
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
