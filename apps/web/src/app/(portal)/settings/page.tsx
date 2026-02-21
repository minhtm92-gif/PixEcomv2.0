'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { apiGet, apiPatch, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { Settings, Store, Wrench, Save, Loader2 } from 'lucide-react';
import type {
  SellerProfile,
  SellerSettings,
  UpdateSellerDto,
  UpdateSellerSettingsDto,
} from '@/types/api';

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'VND', label: 'VND — Vietnamese Dong' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho Chi Minh (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'America/New_York', label: 'America/New York (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (UTC-8)' },
  { value: 'America/Chicago', label: 'America/Chicago (UTC-6)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+11)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (UTC+13)' },
];

const inputCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

const selectCls =
  'w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

export default function SettingsPage() {
  const addToast = useToastStore((s) => s.add);

  // ── Store Profile state ──
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileLogo, setProfileLogo] = useState('');

  // ── Store Settings state ──
  const [settings, setSettings] = useState<SellerSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [supportEmail, setSupportEmail] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');
  const [gaId, setGaId] = useState('');

  // ── Fetch profile ──
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await apiGet<SellerProfile>('/sellers/me');
      setProfile(data);
      setProfileName(data.name);
      setProfileLogo(data.logoUrl ?? '');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // ── Fetch settings ──
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await apiGet<SellerSettings>('/sellers/me/settings');
      setSettings(data);
      setBrandName(data.brandName ?? '');
      setCurrency(data.defaultCurrency ?? 'USD');
      setTimezone(data.timezone ?? 'Asia/Ho_Chi_Minh');
      setSupportEmail(data.supportEmail ?? '');
      setMetaPixelId(data.metaPixelId ?? '');
      setGaId(data.googleAnalyticsId ?? '');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSettings();
  }, [fetchProfile, fetchSettings]);

  // ── Save profile ──
  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const body: UpdateSellerDto = {};
      if (profileName !== profile?.name) body.name = profileName;
      if (profileLogo !== (profile?.logoUrl ?? '')) body.logoUrl = profileLogo;

      const updated = await apiPatch<SellerProfile>('/sellers/me', body);
      setProfile(updated);
      addToast('Store profile updated', 'success');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Save settings ──
  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const body: UpdateSellerSettingsDto = {};
      if (brandName !== (settings?.brandName ?? '')) body.brandName = brandName;
      if (currency !== (settings?.defaultCurrency ?? 'USD')) body.defaultCurrency = currency;
      if (timezone !== (settings?.timezone ?? 'Asia/Ho_Chi_Minh')) body.timezone = timezone;
      if (supportEmail !== (settings?.supportEmail ?? '')) body.supportEmail = supportEmail;
      if (metaPixelId !== (settings?.metaPixelId ?? '')) body.metaPixelId = metaPixelId;
      if (gaId !== (settings?.googleAnalyticsId ?? '')) body.googleAnalyticsId = gaId;

      const updated = await apiPatch<SellerSettings>('/sellers/me/settings', body);
      setSettings(updated);
      addToast('Store settings updated', 'success');
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings size={22} />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your store profile and configuration
        </p>
      </div>

      {/* Section 1: Store Profile */}
      <form onSubmit={handleSaveProfile} className="mb-6">
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Store size={16} />
              Store Profile
            </h2>
          </div>

          <div className="p-5 space-y-4">
            {profileLoading ? (
              <div className="space-y-4">
                <div className="h-10 bg-muted rounded animate-pulse" />
                <div className="h-10 bg-muted rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="store-name" className="block text-sm text-muted-foreground mb-1.5">
                    Store Name
                  </label>
                  <input
                    id="store-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className={inputCls}
                    placeholder="My Store"
                  />
                </div>

                <div>
                  <label htmlFor="logo-url" className="block text-sm text-muted-foreground mb-1.5">
                    Logo URL
                  </label>
                  <input
                    id="logo-url"
                    type="text"
                    value={profileLogo}
                    onChange={(e) => setProfileLogo(e.target.value)}
                    className={inputCls}
                    placeholder="https://cdn.example.com/logo.png"
                  />
                </div>

                {profile && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Slug: <code className="bg-muted/40 px-1.5 py-0.5 rounded">{profile.slug}</code></span>
                    <span>Status: <span className={profile.isActive ? 'text-green-400' : 'text-red-400'}>{profile.isActive ? 'Active' : 'Inactive'}</span></span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-end">
            <button
              type="submit"
              disabled={profileSaving || profileLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Section 2: Store Settings */}
      <form onSubmit={handleSaveSettings}>
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wrench size={16} />
              Store Settings
            </h2>
          </div>

          <div className="p-5 space-y-4">
            {settingsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="brand-name" className="block text-sm text-muted-foreground mb-1.5">
                    Brand Name
                  </label>
                  <input
                    id="brand-name"
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className={inputCls}
                    placeholder="My Brand"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="currency" className="block text-sm text-muted-foreground mb-1.5">
                      Currency
                    </label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className={selectCls}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="timezone" className="block text-sm text-muted-foreground mb-1.5">
                      Timezone
                    </label>
                    <select
                      id="timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={selectCls}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="support-email" className="block text-sm text-muted-foreground mb-1.5">
                    Support Email
                  </label>
                  <input
                    id="support-email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className={inputCls}
                    placeholder="support@mystore.com"
                  />
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">Tracking</p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="meta-pixel" className="block text-sm text-muted-foreground mb-1.5">
                        Meta Pixel ID
                      </label>
                      <input
                        id="meta-pixel"
                        type="text"
                        value={metaPixelId}
                        onChange={(e) => setMetaPixelId(e.target.value)}
                        className={inputCls}
                        placeholder="123456789012345"
                      />
                    </div>

                    <div>
                      <label htmlFor="ga-id" className="block text-sm text-muted-foreground mb-1.5">
                        Google Analytics ID
                      </label>
                      <input
                        id="ga-id"
                        type="text"
                        value={gaId}
                        onChange={(e) => setGaId(e.target.value)}
                        className={inputCls}
                        placeholder="G-XXXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-end">
            <button
              type="submit"
              disabled={settingsSaving || settingsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {settingsSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
