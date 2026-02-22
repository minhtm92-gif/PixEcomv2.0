'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Clock,
  RefreshCw,
  MapPin,
  CreditCard,
  BarChart3,
  ExternalLink,
  Truck,
} from 'lucide-react';
import { apiGet, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, fmtDateTime } from '@/lib/format';
import type { OrderDetail } from '@/types/api';

const EVENT_ICONS: Record<string, string> = {
  CREATED: '📦',
  CONFIRMED: '✅',
  PROCESSING: '⚙️',
  SHIPPED: '🚚',
  DELIVERED: '🏠',
  CANCELLED: '❌',
  REFUNDED: '💸',
  NOTE_ADDED: '📝',
};

const SOURCE_COLORS: Record<string, string> = {
  facebook: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  tiktok: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  google: 'bg-green-500/15 text-green-400 border-green-500/30',
  email: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  direct: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  other: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

function SourceBadge({ source }: { source: string }) {
  const key = source.toLowerCase();
  const cls = SOURCE_COLORS[key] ?? SOURCE_COLORS.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {source}
    </span>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.add);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<OrderDetail>(`/orders/${id}`)
      .then((data) => setOrder(data))
      .catch((err: ApiError) => {
        setError(err.message ?? 'Failed to load order');
        toastApiError(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-64 animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={16} /> Back to Orders
        </button>
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error ?? 'Order not found'}
        </div>
      </div>
    );
  }

  const addr = order.shippingAddress;
  const hasAddress = addr && (addr.line1 || addr.city || addr.country);
  const hasPayment = order.paymentMethod || order.paymentId;
  const attr = order.attribution;
  const hasAttribution = attr && (attr.source || attr.utmSource);
  const hasUtm = attr && (attr.utmSource || attr.utmMedium || attr.utmCampaign || attr.utmContent || attr.utmTerm);

  return (
    <div className="p-6 max-w-4xl">
      {/* Back + Header */}
      <button onClick={() => router.push('/orders')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={16} /> Back to Orders
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground font-mono">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <span className="text-sm text-muted-foreground ml-auto">{fmtDateTime(order.createdAt)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Customer */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Customer</h2>
          <p className="text-foreground font-medium">{order.customer.name ?? 'N/A'}</p>
          <p className="text-sm text-muted-foreground">{order.customer.email}</p>
          {order.customer.phone && (
            <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
          )}
        </div>

        {/* Totals */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Totals</h2>
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={moneyWhole(order.totals.subtotal, order.totals.currency)} />
            <Row label="Shipping" value={moneyWhole(order.totals.shipping, order.totals.currency)} />
            <Row label="Tax" value={moneyWhole(order.totals.tax, order.totals.currency)} />
            {order.totals.discount > 0 && (
              <Row label="Discount" value={`-${moneyWhole(order.totals.discount, order.totals.currency)}`} />
            )}
            <div className="border-t border-border pt-1 mt-1">
              <Row label="Total" value={moneyWhole(order.totals.total, order.totals.currency)} bold />
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Address + Payment — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Shipping Address */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <MapPin size={14} /> Shipping Address
          </h2>
          {hasAddress ? (
            <div className="text-sm text-foreground space-y-0.5">
              {addr.name && <p className="font-medium">{addr.name}</p>}
              {addr.line1 && <p>{addr.line1}</p>}
              {addr.line2 && <p>{addr.line2}</p>}
              <p>
                {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
              </p>
              {addr.country && <p>{addr.country}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No shipping address</p>
          )}
        </div>

        {/* Payment */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <CreditCard size={14} /> Payment
          </h2>
          {hasPayment ? (
            <div className="text-sm space-y-1.5">
              {order.paymentMethod && (
                <div>
                  <span className="text-muted-foreground">Method: </span>
                  <span className="text-foreground font-medium capitalize">{order.paymentMethod}</span>
                </div>
              )}
              {order.paymentId && (
                <div>
                  <span className="text-muted-foreground">Transaction ID: </span>
                  <span className="text-foreground font-mono text-xs">{order.paymentId}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payment info</p>
          )}
        </div>
      </div>

      {/* Attribution */}
      {hasAttribution && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 size={14} /> Attribution
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {attr.source && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Source:</span>
                <SourceBadge source={attr.source} />
              </div>
            )}
          </div>
          {hasUtm && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {attr.utmSource && <UtmTag label="utm_source" value={attr.utmSource} />}
              {attr.utmMedium && <UtmTag label="utm_medium" value={attr.utmMedium} />}
              {attr.utmCampaign && <UtmTag label="utm_campaign" value={attr.utmCampaign} />}
              {attr.utmContent && <UtmTag label="utm_content" value={attr.utmContent} />}
              {attr.utmTerm && <UtmTag label="utm_term" value={attr.utmTerm} />}
            </div>
          )}
        </div>
      )}

      {/* Tracking */}
      {(order.trackingNumber || order.trackingUrl) && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Truck size={14} /> Tracking
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-foreground">{order.trackingNumber ?? '—'}</span>
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
              >
                <ExternalLink size={12} /> Track
              </a>
            )}
          </div>
        </div>
      )}

      {/* Sellpage */}
      {order.sellpage && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Sellpage</h2>
          <a
            href={order.sellpage.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm hover:underline"
          >
            {order.sellpage.url}
          </a>
        </div>
      )}

      {/* Items */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Package size={16} /> Items ({order.items.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-xs text-muted-foreground">Product</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground">Variant</th>
              <th className="text-center px-4 py-2 text-xs text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-2 text-xs text-muted-foreground">Unit Price</th>
              <th className="text-right px-4 py-2 text-xs text-muted-foreground">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-foreground">{item.productTitle}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.variantTitle ?? '—'}</td>
                <td className="px-4 py-3 text-center text-foreground">{item.qty}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{moneyWhole(item.unitPrice, order.totals.currency)}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">{moneyWhole(item.lineTotal, order.totals.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Refresh Tracking button */}
      <div className="mb-4">
        <button
          disabled
          title="Coming soon — endpoint not yet available"
          className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} />
          Refresh Tracking
          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">Coming soon</span>
        </button>
      </div>

      {/* Events timeline */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
          <Clock size={16} /> Timeline ({order.events.length} events)
        </h2>
        {order.events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No events recorded.</p>
        ) : (
          <div className="space-y-3">
            {order.events.map((evt, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{EVENT_ICONS[evt.type] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{evt.type}</span>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(evt.at)}</span>
                  </div>
                  {evt.note && <p className="text-xs text-muted-foreground mt-0.5">{evt.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'text-foreground font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-foreground font-bold' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function UtmTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 border border-border rounded px-2 py-1">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  );
}
