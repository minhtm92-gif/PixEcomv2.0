'use client';

import { useParams } from 'next/navigation';
import { ClipboardList, Package, User, Store, CreditCard } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole, fmtDate, fmtDateTime, safeDecimal } from '@/lib/format';
import { useAdminApi } from '@/hooks/useAdminApi';

// ── API response types ────────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  product: { id: string; name: string; slug: string } | null;
  variant: { id: string; name: string; sku: string } | null;
}

interface OrderEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

interface OrderDetailApi {
  id: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: Record<string, string> | null;
  total: string | number;
  subtotal: string | number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  transactionId: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  seller: { id: string; name: string; slug: string } | null;
  sellpage: { id: string; slug: string; titleOverride: string | null } | null;
  items: OrderItem[];
  events: OrderEvent[];
}

function getTimeline(status: OrderStatus) {
  if (status === 'CANCELLED') {
    return [
      { label: 'Order Placed', done: true },
      { label: 'Cancelled', done: true },
    ];
  }
  if (status === 'REFUNDED') {
    return [
      { label: 'Order Placed', done: true },
      { label: 'Confirmed', done: true },
      { label: 'Refunded', done: true },
    ];
  }
  const steps = [
    { label: 'Order Placed', statuses: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
    { label: 'Confirmed', statuses: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] },
    { label: 'Shipped', statuses: ['SHIPPED', 'DELIVERED'] },
    { label: 'Delivered', statuses: ['DELIVERED'] },
  ];
  return steps.map((s) => ({ label: s.label, done: s.statuses.includes(status) }));
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error } = useAdminApi<OrderDetailApi>(
    `/admin/orders/${id}`,
  );

  // Loading
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <PageShell
        icon={<ClipboardList size={20} className="text-amber-400" />}
        title="Error"
        subtitle=""
        backHref="/admin/orders"
        backLabel="Orders"
      >
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-8 text-center">
          {error}
        </div>
      </PageShell>
    );
  }

  if (!order) {
    return (
      <PageShell
        icon={<ClipboardList size={20} className="text-amber-400" />}
        title="Order Not Found"
        subtitle=""
        backHref="/admin/orders"
        backLabel="Orders"
      >
        <p className="text-muted-foreground text-sm">Order &quot;{id}&quot; does not exist.</p>
      </PageShell>
    );
  }

  const timeline = getTimeline(order.status as OrderStatus);
  const total = safeDecimal(order.total);
  const subtotal = safeDecimal(order.subtotal);
  const shippingAddr = order.shippingAddress as Record<string, string> | null;
  const addressLine = shippingAddr
    ? [shippingAddr.line1 ?? shippingAddr.street, shippingAddr.line2, shippingAddr.city, shippingAddr.state, shippingAddr.postalCode ?? shippingAddr.zip, shippingAddr.country]
        .filter(Boolean)
        .join(', ')
    : '—';

  return (
    <PageShell
      icon={<ClipboardList size={20} className="text-amber-400" />}
      title={order.orderNumber}
      subtitle={`Placed ${fmtDateTime(order.createdAt)}`}
      backHref="/admin/orders"
      backLabel="Orders"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Summary */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package size={14} className="text-amber-400" />
            Order Summary
          </h2>
          <div className="space-y-3">
            <Row label="Order #" value={<span className="font-mono">{order.orderNumber}</span>} />
            <Row label="Status" value={<StatusBadge status={order.status} />} />
            <Row
              label="Items"
              value={order.items.map((i) => i.productName).join(', ') || 'N/A'}
            />
            <Row
              label="Subtotal"
              value={<span className="font-mono">{moneyWhole(subtotal, order.currency)}</span>}
            />
            <Row
              label="Total"
              value={
                <span className="font-mono font-bold text-foreground">{moneyWhole(total, order.currency)}</span>
              }
            />
            <Row label="Date" value={fmtDate(order.createdAt)} />
            {order.trackingNumber && (
              <Row
                label="Tracking"
                value={<span className="font-mono text-xs">{order.trackingNumber}</span>}
              />
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User size={14} className="text-amber-400" />
            Customer
          </h2>
          <div className="space-y-3">
            <Row label="Name" value={order.customerName ?? '—'} />
            <Row label="Email" value={order.customerEmail ?? '—'} />
            <Row label="Phone" value={order.customerPhone ?? '—'} />
            <Row label="Address" value={addressLine} />
          </div>
        </div>

        {/* Seller */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Store size={14} className="text-amber-400" />
            Seller
          </h2>
          <div className="space-y-3">
            <Row label="Store" value={order.seller?.name ?? '—'} />
            <Row
              label="Seller ID"
              value={
                <span className="font-mono text-xs text-muted-foreground">{order.seller?.id ?? '—'}</span>
              }
            />
            {order.sellpage && (
              <Row
                label="Sellpage"
                value={
                  <span className="font-mono text-xs">{order.sellpage.titleOverride ?? order.sellpage.slug}</span>
                }
              />
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard size={14} className="text-amber-400" />
            Payment
          </h2>
          <div className="space-y-3">
            <Row label="Method" value={order.paymentMethod ?? '—'} />
            <Row label="Amount" value={<span className="font-mono">{moneyWhole(total, order.currency)}</span>} />
            <Row
              label="Status"
              value={
                order.status === 'CONFIRMED' || order.status === 'SHIPPED' || order.status === 'DELIVERED' ? (
                  <span className="text-green-400 text-xs font-medium">Captured</span>
                ) : order.status === 'PENDING' ? (
                  <span className="text-amber-400 text-xs font-medium">Pending</span>
                ) : (
                  <span className="text-muted-foreground text-xs font-medium">{order.status}</span>
                )
              }
            />
            {order.transactionId && (
              <Row
                label="Transaction ID"
                value={
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.transactionId}
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      {order.items.length > 0 && (
        <div className="mt-6 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Order Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Product</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Variant</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">{item.productName}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{item.variant?.name ?? item.variantName ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                    <td className="px-3 py-2 text-right font-mono">{moneyWhole(safeDecimal(item.unitPrice), order.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">{moneyWhole(safeDecimal(item.lineTotal), order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-6 bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Order Timeline</h2>
        <div className="space-y-3">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  t.done ? 'bg-amber-400' : 'bg-muted-foreground/30'
                }`}
              />
              <div>
                <p
                  className={`text-sm font-medium ${
                    t.done ? 'text-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  {t.label}
                </p>
                {t.done && (
                  <p className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      {order.events.length > 0 && (
        <div className="mt-6 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Events ({order.events.length})</h2>
          <div className="space-y-2">
            {order.events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="text-sm font-medium text-foreground">{ev.type}</span>
                </div>
                <span className="text-xs text-muted-foreground">{fmtDateTime(ev.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
