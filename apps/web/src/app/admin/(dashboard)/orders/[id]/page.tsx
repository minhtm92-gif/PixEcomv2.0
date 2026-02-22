'use client';

import { useParams } from 'next/navigation';
import { ClipboardList, Package, User, Store, CreditCard } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { moneyWhole } from '@/lib/format';
import { MOCK_ADMIN_ORDERS } from '@/mock/admin';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

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
  const order = MOCK_ADMIN_ORDERS.find((o) => o.id === id);

  if (!order) {
    return (
      <PageShell
        icon={<ClipboardList size={20} className="text-amber-400" />}
        title="Order Not Found"
        subtitle=""
      >
        <p className="text-muted-foreground text-sm">Order &quot;{id}&quot; does not exist.</p>
      </PageShell>
    );
  }

  const timeline = getTimeline(order.status as OrderStatus);

  return (
    <PageShell
      icon={<ClipboardList size={20} className="text-amber-400" />}
      title={order.orderNumber}
      subtitle={`Placed ${order.createdAt}`}
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
            <Row label="Product" value={order.product} />
            <Row
              label="Total"
              value={
                <span className="font-mono font-bold text-foreground">{moneyWhole(order.total)}</span>
              }
            />
            <Row label="Date" value={order.createdAt} />
          </div>
        </div>

        {/* Customer */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User size={14} className="text-amber-400" />
            Customer
          </h2>
          <div className="space-y-3">
            <Row label="Name" value={order.customer} />
            <Row label="Email" value="customer@example.com" />
            <Row label="Phone" value="+1 555-0000" />
            <Row label="Address" value="123 Main St, New York, NY 10001" />
          </div>
        </div>

        {/* Seller */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Store size={14} className="text-amber-400" />
            Seller
          </h2>
          <div className="space-y-3">
            <Row label="Store" value={order.sellerName} />
            <Row
              label="Seller ID"
              value={
                <span className="font-mono text-xs text-muted-foreground">{order.sellerId}</span>
              }
            />
          </div>
        </div>

        {/* Payment */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard size={14} className="text-amber-400" />
            Payment
          </h2>
          <div className="space-y-3">
            <Row label="Method" value="Stripe" />
            <Row label="Amount" value={<span className="font-mono">{moneyWhole(order.total)}</span>} />
            <Row
              label="Status"
              value={<span className="text-green-400 text-xs font-medium">Captured</span>}
            />
            <Row
              label="Transaction ID"
              value={
                <span className="font-mono text-xs text-muted-foreground">
                  pi_mock_{order.id}
                </span>
              }
            />
          </div>
        </div>
      </div>

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
                  <p className="text-xs text-muted-foreground">{order.createdAt}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
