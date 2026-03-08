import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListOrdersQueryDto } from './dto/list-orders.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_EXPORT_ROWS = 5000;
const RATE_LIMIT_WINDOW_MS = 30_000; // 30 seconds

// ─── In-memory rate limiter ────────────────────────────────────────────────────
// Map<sellerId, lastExportTimestamp>
const exportLastTs = new Map<string, number>();

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if contains comma, newline, or double quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsv).join(',');
}

/** Extract address field with backward compat (line1/street, postalCode/zip) */
function addr(
  obj: Record<string, unknown> | null | undefined,
  field: string,
): string {
  if (!obj) return '';
  if (field === 'line1') return String(obj.line1 ?? obj.street ?? '');
  if (field === 'postalCode') return String(obj.postalCode ?? obj.zip ?? '');
  return String(obj[field] ?? '');
}

const CSV_HEADER = buildRow([
  'OrderNumber',
  'Date',
  'Status',
  'CustomerName',
  'CustomerEmail',
  'CustomerPhone',
  'ProductName',
  'VariantName',
  'SKU',
  'Qty',
  'UnitPrice',
  'LineTotal',
  'Subtotal',
  'ShippingPrice',
  'DiscountPrice',
  'Total',
  'Currency',
  'Source',
  'TrackingNumber',
  'TransactionId',
  'PaymentMethod',
  'PaidAt',
  // Shipping address (parsed)
  'ShippingAddress1',
  'ShippingAddress2',
  'ShippingCity',
  'ShippingState',
  'ShippingZip',
  'ShippingCountry',
  'ShippingCountryCode',
  'ShippingPhone',
  // Billing address (parsed)
  'BillingFirstName',
  'BillingLastName',
  'BillingAddress1',
  'BillingAddress2',
  'BillingCity',
  'BillingState',
  'BillingZip',
  'BillingCountry',
  'BillingCountryCode',
]);

// ─── Date helpers (reuse same pattern as orders.service) ──────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateStart(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

function toDateEnd(d: string): Date {
  return new Date(`${d}T23:59:59.999Z`);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrdersExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export orders as CSV (UTF-8 BOM).
   * One row per OrderItem — denormalized order header fields per row.
   * Max 5000 rows. Rate limited 1 export per 30s per seller.
   */
  async exportCsv(
    sellerId: string,
    query: ListOrdersQueryDto,
  ): Promise<string> {
    // ── Rate limit ───────────────────────────────────────────────────────────
    const now = Date.now();
    const last = exportLastTs.get(sellerId) ?? 0;
    if (now - last < RATE_LIMIT_WINDOW_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000);
      throw new HttpException(
        { message: `Export rate limit exceeded. Retry after ${retryAfter}s.`, retryAfter },
        429,
      );
    }
    exportLastTs.set(sellerId, now);

    // ── Build WHERE ──────────────────────────────────────────────────────────
    const dateFrom = query.dateFrom ?? todayUTC();
    const dateTo = query.dateTo ?? todayUTC();

    const andClauses: Record<string, unknown>[] = [
      { sellerId },
      { createdAt: { gte: toDateStart(dateFrom), lte: toDateEnd(dateTo) } },
    ];

    if (query.status) {
      andClauses.push({ status: query.status });
    }
    if (query.source) {
      andClauses.push({ source: query.source });
    }

    // ── Query orders + items ─────────────────────────────────────────────────
    const orders = await this.prisma.order.findMany({
      where: { AND: andClauses },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        orderNumber: true,
        createdAt: true,
        status: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        total: true,
        currency: true,
        source: true,
        trackingNumber: true,
        transactionId: true,
        paymentMethod: true,
        paidAt: true,
        shippingAddress: true,
        billingAddress: true,
        items: {
          select: {
            productName: true,
            variantName: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // ── Build CSV rows ───────────────────────────────────────────────────────
    const lines: string[] = [CSV_HEADER];
    let rowCount = 0;

    for (const order of orders) {
      if (rowCount >= MAX_EXPORT_ROWS) break;

      const dateStr = order.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      const paidStr = order.paidAt
        ? order.paidAt.toISOString().replace('T', ' ').slice(0, 19)
        : '';
      const sa = (order.shippingAddress ?? {}) as Record<string, unknown>;
      const ba = (order.billingAddress ?? null) as Record<string, unknown> | null;

      // Orders with no items still get 1 row
      const items = order.items.length > 0 ? order.items : [null];

      for (const item of items) {
        if (rowCount >= MAX_EXPORT_ROWS) break;

        lines.push(buildRow([
          order.orderNumber,
          dateStr,
          order.status,
          order.customerName,
          order.customerEmail,
          order.customerPhone,
          item?.productName ?? '',
          item?.variantName ?? '',
          item?.sku ?? '',
          item?.quantity ?? '',
          item ? Number(item.unitPrice) : '',
          item ? Number(item.lineTotal) : '',
          Number(order.subtotal),
          Number(order.shippingCost),
          Number(order.discountAmount),
          Number(order.total),
          order.currency,
          order.source,
          order.trackingNumber,
          order.transactionId,
          order.paymentMethod,
          paidStr,
          // Shipping address (parsed)
          addr(sa, 'line1'),
          addr(sa, 'line2'),
          addr(sa, 'city'),
          addr(sa, 'state'),
          addr(sa, 'postalCode'),
          addr(sa, 'country'),
          addr(sa, 'countryCode'),
          order.customerPhone,
          // Billing address
          addr(ba, 'firstName'),
          addr(ba, 'lastName'),
          addr(ba, 'line1'),
          addr(ba, 'line2'),
          addr(ba, 'city'),
          addr(ba, 'state'),
          addr(ba, 'postalCode'),
          addr(ba, 'country'),
          addr(ba, 'countryCode'),
        ]));

        rowCount++;
      }
    }

    // UTF-8 BOM + lines joined by CRLF (Excel compatibility)
    return '\uFEFF' + lines.join('\r\n');
  }
}
