'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiCard } from '@/components/KpiCard';
import { fmtDate, moneyWhole } from '@/lib/format';
import type { SellpageDetail } from '@/types/api';

export default function SellpageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sp, setSp] = useState<SellpageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<SellpageDetail>(`/sellpages/${id}`)
      .then((data) => setSp(data))
      .catch((err: ApiError) => {
        setError(err.message ?? 'Failed to load sellpage');
        toastApiError(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-64 animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !sp) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Sellpage not found'}
        </div>
      </div>
    );
  }

  const isStub = sp.stats.revenue === 0 && sp.stats.cost === 0 && sp.stats.youTake === 0;

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.push('/sellpages')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Sellpages
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">{sp.titleOverride ?? sp.slug}</h1>
        <StatusBadge status={sp.status} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Domain & URL */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">URL / Domain</h2>
          <p className="text-sm text-foreground mb-1">Slug: <span className="font-mono">/{sp.slug}</span></p>
          <p className="text-sm text-muted-foreground mb-2">Type: {sp.sellpageType}</p>
          <a
            href={sp.urlPreview.startsWith('http') ? sp.urlPreview : `https://${sp.urlPreview}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            <ExternalLink size={12} />
            {sp.urlPreview}
          </a>
          <p className="text-xs text-muted-foreground mt-2">
            Created: {fmtDate(sp.createdAt)} &middot; Updated: {fmtDate(sp.updatedAt)}
          </p>
        </div>

        {/* Product */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Linked Product</h2>
          {sp.product ? (
            <div className="flex items-start gap-3">
              {sp.product.heroImageUrl ? (
                <img
                  src={sp.product.heroImageUrl}
                  alt={sp.product.name}
                  className="w-12 h-12 rounded object-cover bg-muted"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <ImageIcon size={18} className="text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{sp.product.name}</p>
                <p className="text-xs text-muted-foreground font-mono">/{sp.product.slug}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Base price: ${Number(sp.product.basePrice).toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No product linked</p>
          )}
        </div>
      </div>

      {/* Description */}
      {sp.descriptionOverride && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Description Override</h2>
          <p className="text-sm text-foreground">{sp.descriptionOverride}</p>
        </div>
      )}

      {/* Stats */}
      <h2 className="text-sm font-medium text-foreground mb-3">Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <KpiCard label="Revenue" value={isStub ? '—' : moneyWhole(sp.stats.revenue)} />
        <KpiCard label="Cost" value={isStub ? '—' : moneyWhole(sp.stats.cost)} />
        <KpiCard label="YouTake" value={isStub ? '—' : moneyWhole(sp.stats.youTake)} />
        <KpiCard label="Hold" value={isStub ? '—' : moneyWhole(sp.stats.hold)} />
        <KpiCard label="CashToBalance" value={isStub ? '—' : moneyWhole(sp.stats.cashToBalance)} />
      </div>
      {isStub && (
        <p className="text-xs text-muted-foreground italic mb-6">
          Sellpage stats are stubs — not yet implemented in backend.
        </p>
      )}

      {/* Creative placeholder */}
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">Assigned Creative</p>
        <p className="text-xs text-muted-foreground mt-1">Coming soon — creative assignment endpoint not yet available</p>
      </div>
    </div>
  );
}
