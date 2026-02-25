'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Copy } from 'lucide-react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useAdminApi, useAdminMutation } from '@/hooks/useAdminApi';
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
  };
  sellpages: StoreSellpage[];
}

const TABS = [
  { label: 'Domain Info', value: 'domain' },
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
