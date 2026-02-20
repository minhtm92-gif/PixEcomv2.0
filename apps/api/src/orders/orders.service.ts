import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListOrdersQueryDto } from './dto/list-orders.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Cursor helpers ───────────────────────────────────────────────────────────
// Cursor encodes "createdAt|id" as base64 to support stable keyset pagination
// on (createdAt DESC, id DESC).

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const sep = raw.lastIndexOf('|');
    if (sep === -1) return null;
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// ─── URL helper (consistent with sellpages service pattern) ───────────────────

function buildSellpageUrl(slug: string, hostname: string | null | undefined): string {
  if (hostname) return `https://${hostname}/${slug}`;
  return `<unassigned-domain>/${slug}`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateStart(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

function toDateEnd(d: string): Date {
  return new Date(`${d}T23:59:59.999Z`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderListItem {
  id: string;
  orderNumber: string;
  createdAt: Date;
  sellpage: { id: string; url: string } | null;
  customer: { email: string; name: string | null };
  total: number;
  currency: string;
  status: string;
  itemsCount: number;
  transactionId: string | null;
  trackingNumber: string | null;
  trackingStatus: string | null;
}

export interface OrderListResult {
  items: OrderListItem[];
  nextCursor: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  createdAt: Date;
  sellpage: { id: string; url: string } | null;
  customer: { email: string; name: string | null; phone: string | null };
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    currency: string;
  };
  status: string;
  transactionId: string | null;
  tracking: {
    number: string | null;
    status: string | null;
    url: string | null;
    provider: string | null;
  };
  items: Array<{
    productTitle: string;
    variantTitle: string | null;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  events: Array<{
    type: string;
    at: Date;
    note: string | null;
  }>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(sellerId: string, query: ListOrdersQueryDto): Promise<OrderListResult> {
    const dateFrom = query.dateFrom ?? todayUTC();
    const dateTo = query.dateTo ?? todayUTC();
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    // ── Cursor decode ────────────────────────────────────────────────────────
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    // ── Build WHERE ──────────────────────────────────────────────────────────
    const where: Record<string, unknown> = {
      sellerId,
      createdAt: { gte: toDateStart(dateFrom), lte: toDateEnd(dateTo) },
    };

    if (query.sellpageId) {
      where['sellpageId'] = query.sellpageId;
    }

    if (query.status) {
      where['status'] = query.status;
    }

    if (query.search) {
      const s = query.search;
      where['OR'] = [
        { orderNumber: { startsWith: s } },
        { customerEmail: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Keyset pagination: page after (createdAt, id) cursor
    if (cursorData) {
      where['OR'] = [
        { createdAt: { lt: cursorData.createdAt } },
        {
          createdAt: { equals: cursorData.createdAt },
          id: { lt: cursorData.id },
        },
      ];
    }

    // ── Query ────────────────────────────────────────────────────────────────
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        sellpageId: true,
        customerEmail: true,
        customerName: true,
        total: true,
        currency: true,
        status: true,
        paymentId: true,
        trackingNumber: true,
        trackingStatus: true,
        sellpage: {
          select: {
            id: true,
            slug: true,
            domain: { select: { hostname: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });

    // ── Next cursor ──────────────────────────────────────────────────────────
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    const nextCursor =
      hasMore && rows.length > 0
        ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id)
        : null;

    // ── Map rows ─────────────────────────────────────────────────────────────
    const items: OrderListItem[] = rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      createdAt: r.createdAt,
      sellpage: r.sellpage
        ? {
            id: r.sellpage.id,
            url: buildSellpageUrl(r.sellpage.slug, r.sellpage.domain?.hostname),
          }
        : null,
      customer: { email: r.customerEmail, name: r.customerName },
      total: Number(r.total),
      currency: r.currency,
      status: r.status,
      itemsCount: r._count.items,
      transactionId: r.paymentId ?? null,
      trackingNumber: r.trackingNumber ?? null,
      trackingStatus: r.trackingStatus ?? null,
    }));

    return { items, nextCursor };
  }

  async getOrder(sellerId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId }, // tenant isolation: must match both
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        subtotal: true,
        shippingCost: true,
        taxAmount: true,
        discountAmount: true,
        total: true,
        currency: true,
        status: true,
        paymentId: true,
        trackingNumber: true,
        trackingStatus: true,
        trackingUrl: true,
        trackingProvider: true,
        sellpage: {
          select: {
            id: true,
            slug: true,
            domain: { select: { hostname: true } },
          },
        },
        items: {
          select: {
            productName: true,
            variantName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          select: {
            eventType: true,
            createdAt: true,
            description: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      sellpage: order.sellpage
        ? {
            id: order.sellpage.id,
            url: buildSellpageUrl(order.sellpage.slug, order.sellpage.domain?.hostname),
          }
        : null,
      customer: {
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone ?? null,
      },
      totals: {
        subtotal: Number(order.subtotal),
        shipping: Number(order.shippingCost),
        tax: Number(order.taxAmount),
        discount: Number(order.discountAmount),
        total: Number(order.total),
        currency: order.currency,
      },
      status: order.status,
      transactionId: order.paymentId ?? null,
      tracking: {
        number: order.trackingNumber ?? null,
        status: order.trackingStatus ?? null,
        url: order.trackingUrl ?? null,
        provider: order.trackingProvider ?? null,
      },
      items: order.items.map((i) => ({
        productTitle: i.productName,
        variantTitle: i.variantName ?? null,
        qty: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      events: order.events.map((e) => ({
        type: e.eventType,
        at: e.createdAt,
        note: e.description ?? null,
      })),
    };
  }
}
