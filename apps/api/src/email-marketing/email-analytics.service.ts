import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface EmailOverviewStats {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

export interface FlowStats {
  flowId: string;
  flowName: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

export interface RecoveryStats {
  totalAbandoned: number;
  totalRecovered: number;
  recoveryRate: number;
  revenueRecovered: number;
  cartAbandoned: number;
  cartRecovered: number;
  checkoutAbandoned: number;
  checkoutRecovered: number;
  discountCodesGenerated: number;
  discountCodesUsed: number;
  byEmailNumber: { emailNumber: number; conversions: number }[];
}

export interface RevenueAttribution {
  totalEmailRevenue: number;
  totalRevenue: number;
  emailRevenuePercent: number;
  byFlow: { flowId: string; revenue: number; orders: number }[];
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class EmailAnalyticsService {
  private readonly logger = new Logger(EmailAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Overview stats — aggregate counts and rates for all email jobs.
   *
   * "Delivered" includes SENT, DELIVERED, OPENED, CLICKED
   * (anything that didn't bounce/fail/complain).
   */
  async getOverview(
    sellerId: string,
    dateRange: { from: Date; to: Date },
  ): Promise<EmailOverviewStats> {
    const { from, to } = dateRange;

    // Count totals using groupBy for a single DB roundtrip
    const statusCounts = await this.prisma.emailJob.groupBy({
      by: ['status'],
      where: {
        sellerId,
        createdAt: { gte: from, lte: to },
        status: {
          in: [
            'SENT',
            'DELIVERED',
            'OPENED',
            'CLICKED',
            'BOUNCED',
            'COMPLAINED',
            'FAILED',
          ],
        },
      },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = row._count.id;
    }

    const sent =
      (counts['SENT'] ?? 0) +
      (counts['DELIVERED'] ?? 0) +
      (counts['OPENED'] ?? 0) +
      (counts['CLICKED'] ?? 0) +
      (counts['BOUNCED'] ?? 0) +
      (counts['COMPLAINED'] ?? 0);

    const delivered =
      (counts['SENT'] ?? 0) +
      (counts['DELIVERED'] ?? 0) +
      (counts['OPENED'] ?? 0) +
      (counts['CLICKED'] ?? 0);

    // Count opens and clicks based on the timestamp fields (not status)
    // because status only shows the LATEST status, but openedAt / clickedAt
    // persist even if status later changed.
    const [openedCount, clickedCount] = await Promise.all([
      this.prisma.emailJob.count({
        where: {
          sellerId,
          createdAt: { gte: from, lte: to },
          openedAt: { not: null },
        },
      }),
      this.prisma.emailJob.count({
        where: {
          sellerId,
          createdAt: { gte: from, lte: to },
          clickedAt: { not: null },
        },
      }),
    ]);

    const totalBounced = counts['BOUNCED'] ?? 0;
    const totalComplained = counts['COMPLAINED'] ?? 0;

    return {
      totalSent: sent,
      totalDelivered: delivered,
      totalOpened: openedCount,
      totalClicked: clickedCount,
      totalBounced,
      totalComplained,
      deliveryRate: sent > 0 ? round((delivered / sent) * 100) : 0,
      openRate: delivered > 0 ? round((openedCount / delivered) * 100) : 0,
      clickRate: delivered > 0 ? round((clickedCount / delivered) * 100) : 0,
      bounceRate: sent > 0 ? round((totalBounced / sent) * 100) : 0,
      complaintRate:
        delivered > 0 ? round((totalComplained / delivered) * 100) : 0,
    };
  }

  /**
   * Per-flow breakdown — sent, opened, clicked, rates grouped by flowId.
   */
  async getFlowStats(
    sellerId: string,
    dateRange: { from: Date; to: Date },
  ): Promise<FlowStats[]> {
    const { from, to } = dateRange;

    // Use raw query for efficient single-pass aggregation
    const rows: {
      flow_id: string;
      sent: bigint;
      opened: bigint;
      clicked: bigint;
    }[] = await this.prisma.$queryRawUnsafe(
      `
      SELECT
        flow_id,
        COUNT(*) FILTER (
          WHERE status IN ('SENT','DELIVERED','OPENED','CLICKED','BOUNCED','COMPLAINED')
        ) AS sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked
      FROM email_jobs
      WHERE seller_id = $1::uuid
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY flow_id
      ORDER BY sent DESC
      `,
      sellerId,
      from,
      to,
    );

    return rows.map((row) => {
      const sent = Number(row.sent);
      const opened = Number(row.opened);
      const clicked = Number(row.clicked);

      return {
        flowId: row.flow_id,
        flowName: humanizeFlowId(row.flow_id),
        sent,
        opened,
        clicked,
        openRate: sent > 0 ? round((opened / sent) * 100) : 0,
        clickRate: sent > 0 ? round((clicked / sent) * 100) : 0,
      };
    });
  }

  /**
   * Recovery stats — abandoned cart + checkout recovery metrics.
   */
  async getRecoveryStats(
    sellerId: string,
    dateRange: { from: Date; to: Date },
  ): Promise<RecoveryStats> {
    const { from, to } = dateRange;

    // Aggregate from AbandonedCart table
    const rows: {
      stage: string;
      total: bigint;
      recovered: bigint;
      revenue: number | null;
      discount_used: bigint;
    }[] = await this.prisma.$queryRawUnsafe(
      `
      SELECT
        stage,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE recovered_at IS NOT NULL) AS recovered,
        SUM(CASE WHEN recovered_at IS NOT NULL THEN total_value ELSE 0 END)::float AS revenue,
        COUNT(*) FILTER (WHERE discount_code_used IS NOT NULL) AS discount_used
      FROM abandoned_carts
      WHERE seller_id = $1::uuid
        AND abandoned_at >= $2
        AND abandoned_at <= $3
      GROUP BY stage
      `,
      sellerId,
      from,
      to,
    );

    let totalAbandoned = 0;
    let totalRecovered = 0;
    let revenueRecovered = 0;
    let cartAbandoned = 0;
    let cartRecovered = 0;
    let checkoutAbandoned = 0;
    let checkoutRecovered = 0;
    let discountCodesUsed = 0;

    for (const row of rows) {
      const total = Number(row.total);
      const recovered = Number(row.recovered);
      const revenue = row.revenue ?? 0;
      const discUsed = Number(row.discount_used);

      totalAbandoned += total;
      totalRecovered += recovered;
      revenueRecovered += revenue;
      discountCodesUsed += discUsed;

      if (row.stage === 'cart') {
        cartAbandoned = total;
        cartRecovered = recovered;
      } else if (row.stage === 'checkout') {
        checkoutAbandoned = total;
        checkoutRecovered = recovered;
      }
    }

    // Count discount codes generated and used from the DiscountCode table
    const [discountCodesGenerated, discountCodesUsedCount] = await Promise.all([
      this.prisma.discountCode.count({
        where: {
          sellerId,
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.discountCode.count({
        where: {
          sellerId,
          createdAt: { gte: from, lte: to },
          usedCount: { gt: 0 },
        },
      }),
    ]);

    // Override with actual DiscountCode counts (more accurate than abandoned_carts table)
    discountCodesUsed = discountCodesUsedCount;

    // Conversions by email number (cart_recovery_1, cart_recovery_2, etc.)
    const emailNumberRows: { email_number: number; conversions: bigint }[] =
      await this.prisma.$queryRawUnsafe(
        `
      SELECT
        CAST(
          NULLIF(regexp_replace(ej.flow_id, '^cart_recovery_', ''), ej.flow_id) AS int
        ) AS email_number,
        COUNT(DISTINCT ac.id) AS conversions
      FROM email_jobs ej
      JOIN abandoned_carts ac
        ON ac.seller_id = ej.seller_id
        AND ac.email = ej.to_email
        AND ac.recovered_at IS NOT NULL
        AND ac.recovered_at >= ej.sent_at
        AND ac.recovered_at <= ej.sent_at + INTERVAL '48 hours'
      WHERE ej.seller_id = $1::uuid
        AND ej.flow_id LIKE 'cart_recovery_%'
        AND ej.created_at >= $2
        AND ej.created_at <= $3
        AND ej.status IN ('SENT','DELIVERED','OPENED','CLICKED')
      GROUP BY email_number
      HAVING email_number IS NOT NULL
      ORDER BY email_number
      `,
        sellerId,
        from,
        to,
      );

    const byEmailNumber = emailNumberRows.map((r) => ({
      emailNumber: r.email_number,
      conversions: Number(r.conversions),
    }));

    return {
      totalAbandoned,
      totalRecovered,
      recoveryRate:
        totalAbandoned > 0
          ? round((totalRecovered / totalAbandoned) * 100)
          : 0,
      revenueRecovered: round(revenueRecovered),
      cartAbandoned,
      cartRecovered,
      checkoutAbandoned,
      checkoutRecovered,
      discountCodesGenerated,
      discountCodesUsed,
      byEmailNumber,
    };
  }

  /**
   * Revenue attribution — orders where a customer clicked an email within 7 days.
   *
   * Uses the email click timestamp + order paidAt timestamp for attribution.
   * Also appends utm_source=email & utm_medium={flowId} to wrapped links
   * for more accurate attribution via UTM params on the Order model.
   */
  async getRevenueAttribution(
    sellerId: string,
    dateRange: { from: Date; to: Date },
  ): Promise<RevenueAttribution> {
    const { from, to } = dateRange;

    // Total revenue in period
    const totalRevenueResult: { total: number | null }[] =
      await this.prisma.$queryRawUnsafe(
        `
      SELECT COALESCE(SUM(total)::float, 0) AS total
      FROM orders
      WHERE seller_id = $1::uuid
        AND paid_at >= $2
        AND paid_at <= $3
        AND status NOT IN ('CANCELLED', 'REFUNDED')
      `,
        sellerId,
        from,
        to,
      );

    const totalRevenue = totalRevenueResult[0]?.total ?? 0;

    // Revenue from email-attributed orders
    // Two attribution methods:
    // 1. Click-based: email was clicked within 7 days before order.paidAt
    // 2. UTM-based: order.utm_source = 'email'
    const attributedRows: {
      flow_id: string;
      revenue: number;
      order_count: bigint;
    }[] = await this.prisma.$queryRawUnsafe(
      `
      WITH email_attributed_orders AS (
        -- Click-based attribution: email clicked within 7 days before purchase
        SELECT DISTINCT o.id AS order_id, o.total::float AS revenue, ej.flow_id
        FROM orders o
        JOIN email_jobs ej
          ON ej.seller_id = o.seller_id
          AND ej.to_email = o.customer_email
          AND ej.clicked_at IS NOT NULL
          AND ej.clicked_at >= o.paid_at - INTERVAL '7 days'
          AND ej.clicked_at <= o.paid_at
        WHERE o.seller_id = $1::uuid
          AND o.paid_at >= $2
          AND o.paid_at <= $3
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')

        UNION

        -- UTM-based attribution
        SELECT DISTINCT o.id AS order_id, o.total::float AS revenue,
          COALESCE(o.utm_medium, 'unknown') AS flow_id
        FROM orders o
        WHERE o.seller_id = $1::uuid
          AND o.paid_at >= $2
          AND o.paid_at <= $3
          AND o.utm_source = 'email'
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      )
      SELECT
        flow_id,
        SUM(revenue) AS revenue,
        COUNT(DISTINCT order_id) AS order_count
      FROM email_attributed_orders
      GROUP BY flow_id
      ORDER BY revenue DESC
      `,
      sellerId,
      from,
      to,
    );

    let totalEmailRevenue = 0;
    const byFlow: { flowId: string; revenue: number; orders: number }[] = [];

    for (const row of attributedRows) {
      const revenue = round(row.revenue ?? 0);
      const orders = Number(row.order_count);
      totalEmailRevenue += revenue;
      byFlow.push({
        flowId: row.flow_id,
        revenue,
        orders,
      });
    }

    totalEmailRevenue = round(totalEmailRevenue);

    return {
      totalEmailRevenue,
      totalRevenue: round(totalRevenue),
      emailRevenuePercent:
        totalRevenue > 0
          ? round((totalEmailRevenue / totalRevenue) * 100)
          : 0,
      byFlow,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Humanize a flow ID like 'cart_recovery_1' → 'Cart Recovery 1'
 */
function humanizeFlowId(flowId: string): string {
  return flowId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
