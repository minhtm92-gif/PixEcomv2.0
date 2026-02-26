'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Copy, Upload, X, Image as ImageIcon } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAdminApi, useAdminMutation } from '@/hooks/useAdminApi';
import { apiPost, apiPatch } from '@/lib/apiClient';
import { useToastStore } from '@/stores/toastStore';

// ── API response types ────────────────────────────────────────────────────────

interface StoreSellpage {
  id: string;
  slug: string;
  status: string;
  titleOverride: string | null;
}

interface StoreDetailApi {
  id: string;
  hostname: string;
  sellerId: string;
  verificationMethod: string;
  verificationToken: string;
  status: string;
  isPrimary: boolean;
  verifiedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  seller: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
  sellpages: StoreSellpage[];
}

const TABS = [
  { label: 'Domain Info', value: 'domain' },
  { label: 'Branding', value: 'branding' },
  { label: 'Seller', value: 'seller' },
  { label: 'Sellpages', value: 'sellpages' },
];

export default function StoreDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState('domain');
  const [copied, setCopied] = useState(false);
  const toast = useToastStore((s) => s.add);

  const { data: store, loading, error, refetch } = useAdminApi<StoreDetailApi>(
    `/admin/stores/${id}`,
  );

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [brandingInitialized, setBrandingInitialized] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Sync branding state from store data
  if (store && !brandingInitialized) {
    setLogoUrl(store.seller.logoUrl);
    setFaviconUrl(store.seller.faviconUrl);
    setBrandingInitialized(true);
  }

  const { mutate: verifyDomain, loading: verifying } = useAdminMutation<{
    verified: boolean;
    message: string;
  }>(`/admin/stores/${id}/verify`, 'POST');

  async function handleVerify() {
    try {
      const result = await verifyDomain({});
      if (result.verified) {
        toast('Domain verified successfully!', 'success');
      } else {
        toast(result.message || 'Verification failed', 'error');
      }
      refetch();
    } catch (err: any) {
      toast(err?.message || 'Verification failed', 'error');
    }
  }

  // ── Upload image to R2 via signed URL ──
  async function uploadImage(file: File): Promise<string> {
    const { uploadUrl, publicUrl } = await apiPost<{ uploadUrl: string; publicUrl: string }>(
      '/assets/signed-upload',
      { filename: file.name, contentType: file.type, mediaType: 'IMAGE' },
    );
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  }

  async function handleLogoUpload(files: FileList) {
    if (!store) return;
    setLogoUploading(true);
    try {
      const url = await uploadImage(files[0]);
      setLogoUrl(url);
      await apiPatch(`/admin/sellers/${store.seller.id}`, { logoUrl: url });
      toast('Logo uploaded', 'success');
      refetch();
    } catch {
      toast('Failed to upload logo', 'error');
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleFaviconUpload(files: FileList) {
    if (!store) return;
    setFaviconUploading(true);
    try {
      const url = await uploadImage(files[0]);
      setFaviconUrl(url);
      await apiPatch(`/admin/sellers/${store.seller.id}`, { faviconUrl: url });
      toast('Favicon uploaded', 'success');
      refetch();
    } catch {
      toast('Failed to upload favicon', 'error');
    } finally {
      setFaviconUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!store) return;
    try {
      setLogoUrl(null);
      await apiPatch(`/admin/sellers/${store.seller.id}`, { logoUrl: '' });
      toast('Logo removed', 'success');
      refetch();
    } catch {
      toast('Failed to remove logo', 'error');
    }
  }

  async function handleRemoveFavicon() {
    if (!store) return;
    try {
      setFaviconUrl(null);
      await apiPatch(`/admin/sellers/${store.seller.id}`, { faviconUrl: '' });
      toast('Favicon removed', 'success');
      refetch();
    } catch {
      toast('Failed to remove favicon', 'error');
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading store details...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/admin/stores')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Stores
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/admin/stores')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} /> Stores
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          Store not found
        </div>
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sellpageColumns: Column<StoreSellpage>[] = [
    {
      key: 'slug',
      label: 'Slug',
      render: (r) => <span className="font-mono text-sm text-foreground">{r.slug}</span>,
    },
    {
      key: 'title',
      label: 'Title',
      render: (r) => (
        <span className="text-sm text-foreground">{r.titleOverride ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <button
        onClick={() => router.push('/admin/stores')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Stores
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Globe size={20} className="text-amber-400" />
          {store.hostname}
        </h1>
        <StatusBadge status={store.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Domain Info */}
      {tab === 'domain' && (
        <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-semibold text-foreground mb-4">Domain Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Domain</label>
              <p className="text-sm font-mono text-foreground">{store.hostname}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Status</label>
              <StatusBadge status={store.status} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Verification Method</label>
              <p className="text-sm text-foreground">
                {store.verificationMethod === 'TXT' ? 'TXT Record' : 'A Record'}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Verification Token</label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
                  {store.verificationToken}
                </code>
                <button
                  onClick={() => handleCopy(store.verificationToken)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy token"
                >
                  <Copy size={14} />
                </button>
                {copied && <span className="text-xs text-green-400">Copied!</span>}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Is Primary</label>
              {store.isPrimary ? (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                  Yes
                </span>
              ) : (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400">
                  No
                </span>
              )}
            </div>
            {store.verifiedAt && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Verified At</label>
                <p className="text-sm text-foreground">{fmtDate(store.verifiedAt)}</p>
              </div>
            )}
            {store.failureReason && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Failure Reason</label>
                <p className="text-sm text-red-400">{store.failureReason}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Created</label>
              <p className="text-sm text-foreground">{fmtDate(store.createdAt)}</p>
            </div>
          </div>

          {/* DNS Instructions */}
          <div className="bg-muted rounded-lg p-4 border border-border mt-4">
            <p className="text-sm font-medium text-foreground mb-2">DNS Instructions</p>
            {store.verificationMethod === 'TXT' ? (
              <p className="text-sm text-muted-foreground">
                Add a TXT record to your DNS:{' '}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded text-foreground">
                  {store.verificationToken}
                </code>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add an A record pointing to:{' '}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded text-foreground">
                  143.198.24.81
                </code>
              </p>
            )}
          </div>

          {store.status === 'VERIFIED' ? (
            <div className="mt-4 w-full py-2.5 bg-green-500/15 text-green-400 rounded-lg text-sm font-medium text-center">
              Domain Verified
            </div>
          ) : (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {verifying
                ? 'Verifying...'
                : store.status === 'FAILED'
                  ? 'Retry Verification'
                  : 'Verify Domain'}
            </button>
          )}
        </div>
      )}

      {/* Tab: Branding */}
      {tab === 'branding' && (
        <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-semibold text-foreground mb-4">Store Branding</h2>
          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Store Logo</label>
              <p className="text-xs text-muted-foreground mb-3">
                Displayed in the storefront header. Recommended: 200x60px, PNG or SVG with transparent background.
              </p>
              {logoUrl ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-40 h-16 bg-muted rounded-lg border border-border flex items-center justify-center overflow-hidden">
                    <img src={logoUrl} alt="Store logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors disabled:opacity-50"
                    >
                      Replace
                    </button>
                    <button
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
                    >
                      <X size={12} className="inline mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="w-40 h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-amber-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  {logoUploading ? (
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={16} />
                      <span className="text-xs">Upload Logo</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.length && handleLogoUpload(e.target.files)}
              />
            </div>

            {/* Favicon Upload */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Favicon</label>
              <p className="text-xs text-muted-foreground mb-3">
                Shown in the browser tab. Recommended: 32x32px or 64x64px, PNG or ICO.
              </p>
              {faviconUrl ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 bg-muted rounded-lg border border-border flex items-center justify-center overflow-hidden">
                    <img src={faviconUrl} alt="Favicon" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={faviconUploading}
                      className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors disabled:opacity-50"
                    >
                      Replace
                    </button>
                    <button
                      onClick={handleRemoveFavicon}
                      className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
                    >
                      <X size={12} className="inline mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={faviconUploading}
                  className="w-12 h-12 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-amber-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  {faviconUploading ? (
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon size={16} />
                  )}
                </button>
              )}
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/*,.ico"
                className="hidden"
                onChange={(e) => e.target.files?.length && handleFaviconUpload(e.target.files)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Seller */}
      {tab === 'seller' && (
        <div className="bg-card border border-border rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-semibold text-foreground mb-4">Seller Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Name</label>
              <p className="text-sm text-foreground font-medium">{store.seller.name}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Slug</label>
              <p className="text-sm font-mono text-foreground">{store.seller.slug}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Seller ID</label>
              <p className="text-sm font-mono text-muted-foreground">{store.seller.id}</p>
            </div>
            <button
              onClick={() => router.push(`/admin/sellers/${store.seller.id}`)}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              View Seller Detail &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab: Sellpages */}
      {tab === 'sellpages' && (
        store.sellpages.length > 0 ? (
          <DataTable
            columns={sellpageColumns}
            data={store.sellpages}
            loading={false}
            emptyMessage="No sellpages."
            rowKey={(r) => r.id}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground text-center py-8">
              No sellpages for this domain.
            </p>
          </div>
        )
      )}
    </div>
  );
}
