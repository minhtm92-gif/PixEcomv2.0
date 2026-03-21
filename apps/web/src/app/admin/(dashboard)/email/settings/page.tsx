'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Send,
  Loader2,
  User,
  Phone,
  MapPin,
  Palette,
  ToggleLeft,
  ToggleRight,
  Clock,
  Mail,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useAdminApi } from '@/hooks/useAdminApi';
import { api, apiPost } from '@/lib/apiClient';
import { useToastStore, toastApiError } from '@/stores/toastStore';

// ── Types ───────────────────────────────────────────────────────────────────

interface EmailSettings {
  id?: string;
  storeId?: string;
  // Sender Identity
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  // Support Info
  supportPhone: string;
  supportEmail: string;
  physicalAddress: string;
  // Branding
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  // Flow Toggles
  enabledFlows: Record<string, boolean>;
  // Frequency Cap
  frequencyCap: number;
  // Send Time
  sendTimeOptimization: boolean;
  defaultTimezone: string;
}

const DEFAULT_SETTINGS: EmailSettings = {
  fromEmail: '',
  fromName: '',
  replyToEmail: '',
  supportPhone: '',
  supportEmail: '',
  physicalAddress: '',
  logoUrl: '',
  primaryColor: '#f59e0b',
  secondaryColor: '#1f2937',
  enabledFlows: {
    order_confirmation: true,
    order_shipped: true,
    order_delivered: true,
    cart_recovery_1: true,
    cart_recovery_2: true,
    cart_recovery_3: true,
    welcome: true,
    win_back: false,
    review_request: false,
    refund_confirmation: true,
  },
  frequencyCap: 3,
  sendTimeOptimization: false,
  defaultTimezone: 'America/New_York',
};

const FLOW_LABELS: Record<string, { label: string; description: string; transactional: boolean }> = {
  order_confirmation: { label: 'Order Confirmation', description: 'Sent after successful order', transactional: true },
  order_shipped: { label: 'Order Shipped', description: 'Sent when order is shipped', transactional: true },
  order_delivered: { label: 'Order Delivered', description: 'Sent when order is delivered', transactional: true },
  cart_recovery_1: { label: 'Cart Recovery #1', description: '1 hour after abandonment', transactional: false },
  cart_recovery_2: { label: 'Cart Recovery #2', description: '24 hours after abandonment', transactional: false },
  cart_recovery_3: { label: 'Cart Recovery #3', description: '72 hours after abandonment', transactional: false },
  welcome: { label: 'Welcome Email', description: 'Sent after first purchase', transactional: false },
  win_back: { label: 'Win-Back', description: 'Re-engagement for inactive customers', transactional: false },
  review_request: { label: 'Review Request', description: 'Ask for product review', transactional: false },
  refund_confirmation: { label: 'Refund Confirmation', description: 'Sent after refund processed', transactional: true },
};

const TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Ho_Chi_Minh',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function EmailSettingsPage() {
  const addToast = useToastStore((s) => s.add);
  const { data: settingsData, loading, error: loadError } = useAdminApi<EmailSettings>('/email-settings');

  const [form, setForm] = useState<EmailSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [dirty, setDirty] = useState(false);

  // Populate form when data loads
  useEffect(() => {
    if (settingsData) {
      setForm({
        ...DEFAULT_SETTINGS,
        ...settingsData,
        enabledFlows: {
          ...DEFAULT_SETTINGS.enabledFlows,
          ...(settingsData.enabledFlows ?? {}),
        },
      });
    }
  }, [settingsData]);

  function updateField<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function toggleFlow(flowId: string) {
    setForm((prev) => ({
      ...prev,
      enabledFlows: {
        ...prev.enabledFlows,
        [flowId]: !prev.enabledFlows[flowId],
      },
    }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api('/email-settings', { method: 'PUT', body: form });
      addToast('Email settings saved', 'success');
      setDirty(false);
    } catch (err) {
      toastApiError(err as { code?: string; message?: string; status?: number });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail.trim()) {
      addToast('Please enter a test email address', 'warning');
      return;
    }
    setSendingTest(true);
    try {
      await apiPost('/email-settings/test', { to: testEmail.trim() });
      addToast(`Test email sent to ${testEmail}`, 'success');
    } catch (err) {
      toastApiError(err as { code?: string; message?: string; status?: number });
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading email settings...</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      icon={<Settings size={20} className="text-amber-400" />}
      title="Email Settings"
      subtitle="Configure email sender identity, branding, and flow preferences"
      backHref="/admin/email"
      backLabel="Email Marketing"
      actions={
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Settings
        </button>
      }
    >
      {/* Error */}
      {loadError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-6">
          {loadError}
        </div>
      )}

      <div className="space-y-6">
        {/* Sender Identity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <User size={14} className="text-amber-400" />
            Sender Identity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                From Email
              </label>
              <input
                type="email"
                value={form.fromEmail}
                onChange={(e) => updateField('fromEmail', e.target.value)}
                placeholder="noreply@yourstore.com"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                From Name
              </label>
              <input
                type="text"
                value={form.fromName}
                onChange={(e) => updateField('fromName', e.target.value)}
                placeholder="Your Store Name"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Reply-To Email
              </label>
              <input
                type="email"
                value={form.replyToEmail}
                onChange={(e) => updateField('replyToEmail', e.target.value)}
                placeholder="support@yourstore.com"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Support Info */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Phone size={14} className="text-amber-400" />
            Support Info
            <span className="text-xs text-muted-foreground font-normal ml-1">(CAN-SPAM required)</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Support Phone
              </label>
              <input
                type="text"
                value={form.supportPhone}
                onChange={(e) => updateField('supportPhone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Support Email
              </label>
              <input
                type="email"
                value={form.supportEmail}
                onChange={(e) => updateField('supportEmail', e.target.value)}
                placeholder="support@yourstore.com"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <MapPin size={12} className="inline mr-1" />
                Physical Address
              </label>
              <input
                type="text"
                value={form.physicalAddress}
                onChange={(e) => updateField('physicalAddress', e.target.value)}
                placeholder="123 Main St, Suite 100, City, State 12345"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Palette size={14} className="text-amber-400" />
            Branding
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Logo URL
              </label>
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => updateField('logoUrl', e.target.value)}
                placeholder="https://cdn.yourstore.com/logo.png"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Secondary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={form.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
          </div>
          {form.logoUrl && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Logo Preview:</p>
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="h-12 object-contain rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* Flow Toggles */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Mail size={14} className="text-amber-400" />
            Email Flows
          </h2>
          <div className="space-y-1">
            {/* Transactional flows */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-1">
              Transactional
            </p>
            {Object.entries(FLOW_LABELS)
              .filter(([, info]) => info.transactional)
              .map(([flowId, info]) => (
                <div
                  key={flowId}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{info.label}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  <button
                    onClick={() => toggleFlow(flowId)}
                    className="flex-shrink-0 ml-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {form.enabledFlows[flowId] ? (
                      <ToggleRight size={28} className="text-green-400" />
                    ) : (
                      <ToggleLeft size={28} />
                    )}
                  </button>
                </div>
              ))}

            {/* Marketing flows */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4 pt-3 border-t border-border">
              Marketing / Recovery
            </p>
            {Object.entries(FLOW_LABELS)
              .filter(([, info]) => !info.transactional)
              .map(([flowId, info]) => (
                <div
                  key={flowId}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{info.label}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                  <button
                    onClick={() => toggleFlow(flowId)}
                    className="flex-shrink-0 ml-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {form.enabledFlows[flowId] ? (
                      <ToggleRight size={28} className="text-green-400" />
                    ) : (
                      <ToggleLeft size={28} />
                    )}
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Frequency Cap & Send Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frequency Cap */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Mail size={14} className="text-amber-400" />
              Frequency Cap
            </h2>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Max non-transactional emails per week
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.frequencyCap}
                onChange={(e) => updateField('frequencyCap', parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Transactional emails (order confirmations, shipping, refunds) are not capped.
              </p>
            </div>
          </div>

          {/* Send Time */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Clock size={14} className="text-amber-400" />
              Send Time
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Send Time Optimization</p>
                  <p className="text-xs text-muted-foreground">Optimize delivery based on recipient timezone</p>
                </div>
                <button
                  onClick={() => updateField('sendTimeOptimization', !form.sendTimeOptimization)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {form.sendTimeOptimization ? (
                    <ToggleRight size={28} className="text-green-400" />
                  ) : (
                    <ToggleLeft size={28} />
                  )}
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Default Timezone
                </label>
                <select
                  value={form.defaultTimezone}
                  onChange={(e) => updateField('defaultTimezone', e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Send Test Email */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Send size={14} className="text-amber-400" />
            Send Test Email
          </h2>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Recipient Email
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
            <button
              onClick={handleSendTest}
              disabled={sendingTest}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground font-medium rounded-lg text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Test
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sends a test email using current settings (save first to apply changes).
          </p>
        </div>

        {/* Bottom Save */}
        {dirty && (
          <div className="sticky bottom-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-medium rounded-xl text-sm shadow-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
