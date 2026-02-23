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
  ArrowRight,
  Plus,
  MessageSquare,
  CheckCircle,
  Settings2,
  Home,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { apiGet, apiPatch, type ApiError } from '@/lib/apiClient';
import { toastApiError, useToastStore } from '@/stores/toastStore';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, fmtDateTime } from '@/lib/format';
import type { OrderDetail, OrderTransitionsResponse } from '@/types/api';

// ── Transition button colors ──
const TRANSITION_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-green-600/90 text-white hover:bg-green-500',
  PROCESSING: 'bg-blue-600/90 text-white hover:bg-blue-500',
  SHIPPED: 'bg-indigo-600/90 text-white hover:bg-indigo-500',
  DELIVERED: 'bg-emerald-600/90 text-white hover:bg-emerald-500',
  CANCELLED: 'bg-red-600/90 text-white hover:bg-red-500',
  REFUNDED: 'bg-orange-600/90 text-white hover:bg-orange-500',
};
const DESTRUCTIVE_TRANSITIONS = new Set(['CANCELLED', 'REFUNDED']);

// ── Timeline event icons (lucide) ──
function TimelineIcon({ type }: { type: string }) {
  const cls = 'flex-shrink-0 mt-0.5';
  switch (type) {
    case 'CREATED':
    case 'ORDER_CREATED':
      return <Plus size={15} className={`${cls} text-primary`} />;
    case 'CONFIRMED':
      return <CheckCircle size={15} className={`${cls} text-green-400`} />;
    case 'PROCESSING':
      return <Settings2 size={15} className={`${cls} text-blue-400`} />;
    case 'SHIPPED':
      return <Truck size={15} className={`${cls} text-indigo-400`} />;
    case 'DELIVERED':
      return <Home size={15} className={`${cls} text-emerald-400`} />;
    case 'CANCELLED':
      return <XCircle size={15} className={`${cls} text-red-400`} />;
    case 'REFUNDED':
      return <RotateCcw size={15} className={`${cls} text-orange-400`} />;
    case 'STATUS_CHANGE':
      return <ArrowRight size={15} className={`${cls} text-muted-foreground`} />;
    case 'NOTE_ADDED':
      return <MessageSquare size={15} className={`${cls} text-muted-foreground`} />;
    default:
      return <ArrowRight size={15} className={`${cls} text-muted-foreground`} />;
  }
}

// ── Relative time ──
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDateTime(dateStr);
}

// ── Source badge ──
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
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}
    >
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

  // ── C.1 Transitions ──
  const [transitions, setTransitions] = useState<string[]>([]);
  const [transitionsLoading, setTransitionsLoading] = useState(false);

  // ── C.2 Confirm dialog ──
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [statusChanging, setStatusChanging] = useState(false);

  async function loadOrder() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<OrderDetail>(`/orders/${id}`);
      setOrder(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to load order');
      toastApiError(apiErr);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransitions() {
    if (!id) return;
    setTransitionsLoading(true);
    try {
      const res = await apiGet<OrderTransitionsResponse>(`/orders/${id}/transitions`);
      setTransitions(res.validTransitions ?? []);
    } catch {
      // Non-critical — transitions are bonus UX
    } finally {
      setTransitionsLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
    loadTransitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── C.2 Submit status change ──
  async function handleStatusChange() {
    if (!id || !confirmTarget) return;
    setStatusChanging(true);
    try {
      await apiPatch(`/orders/${id}/status`, {
        status: confirmTarget,
        ...(confirmNote.trim() ? { note: confirmNote.trim() } : {}),
      });
      addToast(`Order moved to ${confirmTarget}`, 'success');
      setConfirmTarget(null);
      setConfirmNote('');
      await Promise.all([loadOrder(), loadTransitions()]);
    } catch (err) {
      toastApiError(err as ApiError);
    } finally {
      setStatusChanging(false);
    }
  }

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
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
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
  const isTerminal = ['CANCELLED', 'REFUNDED', 'DELIVERED'].includes(order.status.toUpperCase());

  return (
    <div className="p-6 max-w-4xl">
      {/* Back + Header */}
      <button
        onClick={() => router.push('/orders')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Back to Orders
      </button>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground font-mono">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <span className="text-sm text-muted-foreground ml-auto">{fmtDateTime(order.createdAt)}</span>
      </div>

      {/* ── C.1 Status Actions ── */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Status Actions</h2>
        {transitionsLoading ? (
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
        ) : isTerminal ? (
          <p className="text-sm text-muted-foreground italic">
            Final status — no further transitions available.
          </p>
        ) : transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No transitions available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => {
              const colorCls =
                TRANSITION_COLORS[t.toUpperCase()] ??
                'bg-muted text-muted-foreground hover:text-foreground';
              return (
                <button
                  key={t}
                  onClick={() => setConfirmTarget(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${colorCls}`}
                >
                  <ArrowRight size={12} />
                  {t}
                </button>
              );
            })}
          </div>
        )}
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
              <Row
                label="Discount"
                value={`-${moneyWhole(order.totals.discount, order.totals.currency)}`}
              />
            )}
            <div className="border-t border-border pt-1 mt-1">
              <Row
                label="Total"
                value={moneyWhole(order.totals.total, order.totals.currency)}
                bold
              />
            </div>
          </div>
        </div>
      </div>

      {/* Shipping + Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <CreditCard size={14} /> Payment
          </h2>
          {hasPayment ? (
            <div className="text-sm space-y-1.5">
              {order.paymentMethod && (
                <div>
                  <span className="text-muted-foreground">Method: </span>
                  <span className="text-foreground font-medium capitalize">
                    {order.paymentMethod}
                  </span>
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
            <span className="text-sm font-mono text-foreground">
              {order.trackingNumber ?? '—'}
            </span>
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
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {moneyWhole(item.unitPrice, order.totals.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {moneyWhole(item.lineTotal, order.totals.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Refresh Tracking (coming soon) */}
      <div className="mb-4">
        <button
          disabled
          title="Coming soon — endpoint not yet available"
          className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} />
          Refresh Tracking
          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">
            Coming soon
          </span>
        </button>
      </div>

      {/* ── C.3 Events timeline ── */}
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
                <TimelineIcon type={evt.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{evt.type}</span>
                    <span
                      className="text-xs text-muted-foreground"
                      title={fmtDateTime(evt.at)}
                    >
                      {timeAgo(evt.at)}
                    </span>
                  </div>
                  {evt.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">{evt.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── C.2 Status Change Confirm Dialog ── */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !statusChanging && setConfirmTarget(null)}
          />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-sm mx-4 p-5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              {DESTRUCTIVE_TRANSITIONS.has(confirmTarget.toUpperCase()) ? (
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
              ) : (
                <ArrowRight size={18} className="text-primary flex-shrink-0" />
              )}
              <h2 className="text-base font-semibold text-foreground">Confirm Status Change</h2>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Change order{' '}
              <span className="text-foreground font-mono font-medium">
                {order.orderNumber}
              </span>{' '}
              from{' '}
              <span className="text-foreground font-medium">{order.status}</span> to{' '}
              <span className="text-foreground font-medium">{confirmTarget}</span>?
              {DESTRUCTIVE_TRANSITIONS.has(confirmTarget.toUpperCase()) && (
                <span className="block mt-1 text-red-400">
                  This action may not be reversible.
                </span>
              )}
            </p>

            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-1.5">
                Note{' '}
                <span className="text-xs text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                rows={2}
                placeholder="Add a note to this status change..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                           resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={statusChanging}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium
                           hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={statusChanging}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity
                           ${
                             DESTRUCTIVE_TRANSITIONS.has(confirmTarget.toUpperCase())
                               ? 'bg-red-600 text-white'
                               : 'bg-primary text-primary-foreground'
                           }`}
              >
                {statusChanging && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'text-foreground font-medium' : 'text-muted-foreground'}>
        {label}
      </span>
      <span className={`font-mono ${bold ? 'text-foreground font-bold' : 'text-foreground'}`}>
        {value}
      </span>
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
