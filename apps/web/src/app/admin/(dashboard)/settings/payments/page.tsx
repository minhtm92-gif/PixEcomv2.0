'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CreditCard,
  ArrowLeft,
  Eye,
  EyeOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Plus,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { useAdminApi } from '@/hooks/useAdminApi';
import { apiPost, apiPatch, apiDelete } from '@/lib/apiClient';

const IS_PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

// ── Types ────────────────────────────────────────────────────────────────────

interface PaymentGatewayApi {
  id: string;
  name: string;
  type: string;
  status: string;
  environment: string;
  credentials: Record<string, string>;
  createdAt: string;
  _count: { sellers: number };
}

interface GatewayRow {
  id: string;
  name: string;
  type: string;
  environment: string;
  status: string;
  credentials: Record<string, string>;
  assignedCount: number;
  createdAt: string;
}

// ── Provider definitions ────────────────────────────────────────────────────

interface ProviderDef {
  type: string;
  name: string;
  description: string;
  logo: React.ReactNode;
  fields: { key: string; label: string; type: 'text' | 'password' }[];
  available: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    type: 'paypal',
    name: 'PayPal Express Checkout',
    description: 'A button that enables customers to use PayPal directly from your checkout',
    logo: (
      <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
        PP
      </div>
    ),
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Secret', type: 'password' },
    ],
    available: true,
  },
  {
    type: 'paypal_pro',
    name: 'PayPal Payflow Pro',
    description: "You'll need a PayPal Business Account to enable PayPal Payflow Pro (ACDC)",
    logo: (
      <div className="w-10 h-10 rounded-lg bg-blue-800 flex items-center justify-center text-white font-bold text-[10px]">
        PP Pro
      </div>
    ),
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' as const },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' as const },
      { key: 'merchantId', label: 'Merchant ID', type: 'text' as const },
    ],
    available: true,
  },
  {
    type: 'stripe',
    name: 'Stripe',
    description: 'Credit Card Payment - stripe.com',
    logo: (
      <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
        S
      </div>
    ),
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
    ],
    available: true,
  },
  {
    type: 'airwallex',
    name: 'Airwallex',
    description: 'Credit Card Payment - airwallex.com',
    logo: (
      <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
        AW
      </div>
    ),
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'apiKey', label: 'API Key', type: 'password' },
    ],
    available: false,
  },
  {
    type: 'tazapay',
    name: 'Tazapay',
    description: 'Credit Card Payment - tazapay.com',
    logo: (
      <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-xs">
        TZ
      </div>
    ),
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text' },
      { key: 'apiSecret', label: 'API Secret', type: 'password' },
    ],
    available: false,
  },
];

const inputCls =
  'w-full px-3 py-2.5 bg-input border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors';

// ── Add Provider Form ────────────────────────────────────────────────────────

function AddProviderForm({
  provider,
  onBack,
  onSaved,
}: {
  provider: ProviderDef;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const environment = 'live';
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateCred = useCallback((key: string, val: string) => {
    setCredentials((prev) => ({ ...prev, [key]: val }));
  }, []);

  const toggleShow = useCallback((key: string) => {
    setShowFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    // Check at least one credential field is filled
    const hasAnyCred = provider.fields.some((f) => credentials[f.key]?.trim());
    if (!hasAnyCred) {
      setError('At least one credential field is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiPost('/admin/payment-gateways', {
        name: name.trim(),
        type: provider.type,
        environment,
        credentials,
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [name, credentials, provider, onSaved]);

  return (
    <div>
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={16} />
        Back to Providers
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: About */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            {provider.logo}
            <h2 className="text-lg font-semibold text-foreground">
              Add {provider.name}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">{provider.description}</p>
        </div>

        {/* Right: Form */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-5">
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name / Label</label>
            <input
              className={inputCls}
              placeholder={`e.g. ${provider.name} Production`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Environment — always live (sandbox not allowed per CEO directive) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Environment</label>
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-lg text-sm font-medium border border-green-500 bg-green-500/10 text-green-400">
                Live
              </div>
            </div>
          </div>

          {/* Credential fields */}
          {provider.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {field.label}
              </label>
              <div className="relative">
                <input
                  className={inputCls + ' pr-10'}
                  type={field.type === 'password' && !showFields[field.key] ? 'password' : 'text'}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  value={credentials[field.key] ?? ''}
                  onChange={(e) => updateCred(field.key, e.target.value)}
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => toggleShow(field.key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showFields[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Active Gateway Card ─────────────────────────────────────────────────────

function GatewayCard({
  gw,
  onToggle,
  onDelete,
}: {
  gw: GatewayRow;
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const provider = PROVIDERS.find((p) => p.type === gw.type);
  const isActive = gw.status === 'ACTIVE';

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 transition-colors hover:border-border/80">
      {provider?.logo ?? (
        <div className="w-10 h-10 rounded-lg bg-gray-600 flex items-center justify-center text-white font-bold text-xs">
          ?
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-foreground">{gw.name}</h3>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              isActive
                ? 'bg-green-500/15 text-green-400'
                : 'bg-gray-500/15 text-gray-400'
            }`}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-green-500/15 text-green-400">
            Live
          </span>
        </div>

        {/* Masked credentials */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
          {Object.entries(gw.credentials).map(([key, val]) => (
            <div key={key} className="text-xs text-muted-foreground">
              <span className="text-muted-foreground/60">{key}:</span>{' '}
              <span className="font-mono">{val}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          {gw.assignedCount} seller{gw.assignedCount !== 1 ? 's' : ''} assigned
          &nbsp;·&nbsp; Added {new Date(gw.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onToggle(gw.id, isActive ? 'INACTIVE' : 'ACTIVE')}
          title={isActive ? 'Deactivate' : 'Activate'}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          {isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
        </button>
        <button
          onClick={() => onDelete(gw.id)}
          title="Delete"
          className="p-1.5 rounded text-muted-foreground hover:text-red-400 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function SettingsPaymentsPage() {
  const [view, setView] = useState<'list' | ProviderDef>('list');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: apiGateways, loading, error, refetch } = useAdminApi<PaymentGatewayApi[]>(
    IS_PREVIEW ? null : '/admin/payment-gateways',
    [refreshKey],
  );

  const gateways: GatewayRow[] = useMemo(() => {
    if (!apiGateways) return [];
    return apiGateways.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      environment: g.environment,
      status: g.status,
      credentials: g.credentials ?? {},
      assignedCount: g._count?.sellers ?? 0,
      createdAt: g.createdAt,
    }));
  }, [apiGateways]);

  const handleToggle = useCallback(
    async (id: string, status: string) => {
      await apiPatch(`/admin/payment-gateways/${id}`, { status });
      setRefreshKey((k) => k + 1);
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this payment gateway?')) return;
      await apiDelete(`/admin/payment-gateways/${id}`);
      setRefreshKey((k) => k + 1);
    },
    [],
  );

  if (!IS_PREVIEW && loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading payment gateways...</p>
        </div>
      </div>
    );
  }

  // If adding a provider
  if (view !== 'list') {
    return (
      <PageShell
        icon={<CreditCard size={20} className="text-amber-400" />}
        title="Payment Gateways"
        backHref="/admin/settings"
        backLabel="Settings"
      >
        <AddProviderForm
          provider={view}
          onBack={() => setView('list')}
          onSaved={() => {
            setView('list');
            setRefreshKey((k) => k + 1);
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={<CreditCard size={20} className="text-amber-400" />}
      title="Payment Gateways"
      backHref="/admin/settings"
      backLabel="Settings"
    >
      {!IS_PREVIEW && error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* ── Active Gateways ────────────────────────────────────────────────── */}
      {gateways.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            Active Gateways ({gateways.length})
          </h2>
          <div className="space-y-3">
            {gateways.map((gw) => (
              <GatewayCard
                key={gw.id}
                gw={gw}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Payment Providers Catalog ─────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Payment Providers
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Accept payments on your store using third-party providers such as PayPal
          or other payment methods.
        </p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Provider</span>
            <span>Description</span>
            <span />
          </div>

          {/* Provider rows */}
          {PROVIDERS.map((p, i) => (
              <div
                key={p.type}
                className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center px-5 py-4 transition-colors hover:bg-muted/20 ${
                  i < PROVIDERS.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                {/* Logo + Name */}
                <div className="flex items-center gap-3">
                  {p.logo}
                  <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {p.name}
                  </span>
                </div>

                {/* Description */}
                <span className="text-sm text-muted-foreground">{p.description}</span>

                {/* Action */}
                <div>
                  {!p.available ? (
                    <span className="text-xs text-muted-foreground italic">
                      Available Soon
                    </span>
                  ) : (
                    <button
                      onClick={() => setView(p)}
                      className="flex items-center gap-1 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-sm font-medium rounded-lg transition-colors"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  )}
                </div>
              </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
