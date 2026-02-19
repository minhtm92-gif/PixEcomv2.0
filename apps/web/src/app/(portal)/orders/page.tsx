'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Package,
  ExternalLink,
  MapPin,
  Clock,
  CreditCard,
  Truck,
  User,
  Mail,
  Phone,
  Hash,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { mockOrders, mockOrderDetails } from '@/mock/orders';
import { formatCurrency, formatDate, formatDateTime, timeAgo } from '@/lib/helpers';
import type { OrderListItem, OrderDetail, OrderEvent } from '@/mock/types';

const STATUS_OPTIONS = [
  'All',
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;

/* ─── Timeline event component ─── */
function EventTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <div className="relative space-y-0">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        return (
          <div key={idx} className="flex gap-3">
            {/* Dot + Line */}
            <div className="flex flex-col items-center">
              <div
                className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                  isLast ? 'bg-primary' : 'bg-muted-foreground/40'
                }`}
              />
              {!isLast && <div className="w-px flex-1 bg-border my-1" />}
            </div>
            {/* Content */}
            <div className="pb-4">
              <p className="text-2sm font-medium text-foreground">{event.type}</p>
              <p className="text-2xs text-muted-foreground">{formatDateTime(event.at)}</p>
              {event.note && (
                <p className="text-2xs text-muted-foreground/70 mt-0.5">{event.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Order detail drawer ─── */
function OrderDrawer({
  order,
  onClose,
}: {
  order: OrderDetail | null;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Sheet open={!!order} onClose={onClose} width="max-w-[520px]">
      <SheetHeader className="pb-4">
        <div className="flex items-center gap-3">
          <SheetTitle>{order.orderNumber}</SheetTitle>
          <StatusBadge status={order.status} />
        </div>
        <SheetDescription>
          Placed {formatDateTime(order.createdAt)} · {timeAgo(order.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-6">
        {/* Customer Info */}
        <section>
          <h4 className="text-2sm font-semibold text-foreground mb-3">Customer</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-2sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{order.customer.name || 'Anonymous'}</span>
            </div>
            <div className="flex items-center gap-2 text-2sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{order.customer.email}</span>
            </div>
            {order.customer.phone && (
              <div className="flex items-center gap-2 text-2sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{order.customer.phone}</span>
              </div>
            )}
          </div>
        </section>

        <Separator />

        {/* Line Items */}
        <section>
          <h4 className="text-2sm font-semibold text-foreground mb-3">Items</h4>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-2sm font-medium text-foreground truncate">
                    {item.productTitle}
                  </p>
                  {item.variantTitle && (
                    <p className="text-2xs text-muted-foreground">{item.variantTitle}</p>
                  )}
                  <p className="text-2xs text-muted-foreground">
                    {item.qty} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <span className="text-2sm font-medium tabular-nums text-foreground ml-3">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* Totals */}
        <section>
          <h4 className="text-2sm font-semibold text-foreground mb-3">Summary</h4>
          <div className="space-y-1.5 text-2sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(order.totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="tabular-nums">
                {order.totals.shipping === 0 ? 'Free' : formatCurrency(order.totals.shipping)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="tabular-nums">{formatCurrency(order.totals.tax)}</span>
            </div>
            {order.totals.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums text-green-400">
                  -{formatCurrency(order.totals.discount)}
                </span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(order.totals.total)}</span>
            </div>
          </div>
        </section>

        <Separator />

        {/* Shipping & Tracking */}
        {order.shippingAddress && (
          <section>
            <h4 className="text-2sm font-semibold text-foreground mb-3">Shipping</h4>
            <div className="flex items-start gap-2 text-2sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <div className="text-muted-foreground">
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.zip}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
            {order.trackingNumber && (
              <div className="flex items-center gap-2 text-2sm mt-2">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-mono text-2xs">
                  {order.trackingNumber}
                </span>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        {/* Payment */}
        {order.paymentMethod && (
          <>
            <Separator />
            <section>
              <div className="flex items-center gap-2 text-2sm">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Paid via {order.paymentMethod}</span>
              </div>
            </section>
          </>
        )}

        <Separator />

        {/* Timeline */}
        <section>
          <h4 className="text-2sm font-semibold text-foreground mb-3">Activity</h4>
          <EventTimeline events={[...order.events].reverse()} />
        </section>
      </SheetBody>
    </Sheet>
  );
}

/* ─── Main Orders Page ─── */
export default function OrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mockOrders.filter((o) => {
      const matchesSearch =
        !search ||
        o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.email.toLowerCase().includes(search.toLowerCase()) ||
        (o.customer.name?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const counts = useMemo(() => ({
    all: mockOrders.length,
    pending: mockOrders.filter((o) => o.status === 'PENDING').length,
    processing: mockOrders.filter((o) => ['CONFIRMED', 'PROCESSING'].includes(o.status)).length,
    shipped: mockOrders.filter((o) => o.status === 'SHIPPED').length,
    delivered: mockOrders.filter((o) => o.status === 'DELIVERED').length,
  }), []);

  const totalRevenue = useMemo(
    () => mockOrders.reduce((sum, o) => sum + o.total, 0),
    [],
  );

  const handleRowClick = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
  }, []);

  const selectedDetail: OrderDetail | null = selectedOrderId
    ? mockOrderDetails[selectedOrderId] ?? null
    : null;

  return (
    <div className="container-fluid space-y-5">
      <PageHeader
        title="Orders"
        subtitle="Track and manage customer orders"
      />

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{counts.all} Total</Badge>
        <Badge variant="warning">{counts.pending} Pending</Badge>
        <Badge variant="primary">{counts.processing} Processing</Badge>
        <Badge variant="info">{counts.shipped} Shipped</Badge>
        <Badge variant="success">{counts.delivered} Delivered</Badge>
        <Badge variant="outline">{formatCurrency(totalRevenue)} Revenue</Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search orders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All Status' : s}
            </option>
          ))}
        </Select>
      </div>

      {/* Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Sellpage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(order.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-2sm font-mono font-medium text-foreground">
                        {order.orderNumber.replace('ORD-', '')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-2sm font-medium text-foreground">
                        {order.customer.name || 'Anonymous'}
                      </p>
                      <p className="text-2xs text-muted-foreground">{order.customer.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.sellpage ? (
                      <span className="text-2xs text-muted-foreground truncate block max-w-[160px]">
                        {new URL(order.sellpage.url).pathname.slice(1)}
                      </span>
                    ) : (
                      <span className="text-2xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-2sm tabular-nums text-muted-foreground">
                      {order.itemsCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-2sm font-medium tabular-nums text-foreground">
                      {formatCurrency(order.total)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="text-2xs text-muted-foreground">
                        {timeAgo(order.createdAt)}
                      </p>
                      <p className="text-2xs text-muted-foreground/60">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No orders found</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('All');
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Results count */}
      <p className="text-2xs text-muted-foreground">
        Showing {filtered.length} of {mockOrders.length} orders
      </p>

      {/* Order Detail Drawer */}
      <OrderDrawer
        order={selectedDetail}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
