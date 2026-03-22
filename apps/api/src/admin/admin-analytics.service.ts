import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Response Types ─────────────────────────────────────────────────────────

interface DailyBreakdown {
  date: string;
  revenue: number;
  orders: number;
  aov: number;
}

<<<<<<< HEAD
interface RevenueResponse {
=======
export interface RevenueResponse {
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  refundRate: number;
  dailyBreakdown: DailyBreakdown[];
}

<<<<<<< HEAD
interface ProductStatsResponse {
=======
export interface ProductStatsResponse {
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  productId: string;
  productName: string;
  revenue: number;
  orders: number;
  returns: number;
  chargebackRate: number;
  roas: number;
  adSpend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
}

<<<<<<< HEAD
interface OverviewResponse {
=======
export interface OverviewResponse {
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  conversionRate: number;
  activeProducts: number;
  averageOrderValue: number;
  revenueToday: number;
  ordersToday: number;
  revenueYesterday: number;
  ordersYesterday: number;
  revenueTrend: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultDateRange(from?: string, to?: string): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateTo = to ? new Date(to) : now;
  const dateFrom = from
    ? new Date(from)
    : new Date(new Date(now).setDate(now.getDate() - 30));
  return { dateFrom, dateTo };
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── GET /admin/analytics/revenue ───────────────────────────────────────────

  async getRevenue(from?: string, to?: string): Promise<RevenueResponse> {
    const { dateFrom, dateTo } = defaultDateRange(from, to);

    // Total orders (paid) in date range
    const [allOrders, refundedOrders, dailyRaw] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { notIn: ['CANCELLED'] },
        },
        select: { id: true, total: true, status: true, createdAt: true },
      }),
      this.prisma.order.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: 'REFUNDED',
        },
      }),
      this.prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(total), 0)::float as revenue,
          COUNT(*)::int as orders
        FROM orders
        WHERE created_at >= ${dateFrom}
          AND created_at <= ${dateTo}
          AND status != 'CANCELLED'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      ` as Promise<Array<{ date: Date; revenue: number; orders: number }>>,
    ]);

    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = allOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const refundRate = totalOrders > 0 ? (refundedOrders / totalOrders) * 100 : 0;

    // Build daily breakdown — fill missing days with zeroes
    const dailyMap = new Map(
      (dailyRaw as any[]).map((d) => [
        new Date(d.date).toISOString().slice(0, 10),
        { revenue: Number(d.revenue), orders: Number(d.orders) },
      ]),
    );

    const dailyBreakdown: DailyBreakdown[] = [];
    const cursor = new Date(dateFrom);
    while (cursor <= dateTo) {
      const key = cursor.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      const rev = entry?.revenue ?? 0;
      const ord = entry?.orders ?? 0;
      dailyBreakdown.push({
        date: key,
        revenue: Math.round(rev * 100) / 100,
        orders: ord,
        aov: ord > 0 ? Math.round((rev / ord) * 100) / 100 : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      refundRate: Math.round(refundRate * 100) / 100,
      dailyBreakdown,
    };
  }

  // ─── GET /admin/products/:id/stats ──────────────────────────────────────────

  async getProductStats(productId: string, from?: string, to?: string): Promise<ProductStatsResponse> {
    const { dateFrom, dateTo } = defaultDateRange(from, to);

    // 1. Get the product
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    const productName = product?.name ?? 'Unknown Product';

    // 2. Revenue & orders from OrderItem → Order
    const orderItemsRaw = await this.prisma.$queryRaw`
      SELECT
        COALESCE(SUM(oi.line_total), 0)::float as revenue,
        COUNT(DISTINCT oi.order_id)::int as orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ${productId}::uuid
        AND o.created_at >= ${dateFrom}
        AND o.created_at <= ${dateTo}
        AND o.status != 'CANCELLED'
    ` as Array<{ revenue: number; orders: number }>;

    const revenue = Number(orderItemsRaw[0]?.revenue ?? 0);
    const orders = Number(orderItemsRaw[0]?.orders ?? 0);

    // 3. Refunded orders (returns) for this product
    const returnsRaw = await this.prisma.$queryRaw`
      SELECT COUNT(DISTINCT oi.order_id)::int as returns
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ${productId}::uuid
        AND o.created_at >= ${dateFrom}
        AND o.created_at <= ${dateTo}
        AND o.status = 'REFUNDED'
    ` as Array<{ returns: number }>;
    const returns = Number(returnsRaw[0]?.returns ?? 0);
    const chargebackRate = orders > 0 ? (returns / orders) * 100 : 0;

    // 4. Ad stats — find campaigns linked to sellpages for this product
    //    Product → Sellpage → Campaign → AdStatsDaily (via entityType CAMPAIGN)
    const adStatsRaw = await this.prisma.$queryRaw`
      SELECT
        COALESCE(SUM(ads.spend), 0)::float as "adSpend",
        COALESCE(SUM(ads.impressions), 0)::int as impressions,
        COALESCE(SUM(ads.link_clicks), 0)::int as clicks
      FROM ad_stats_daily ads
      WHERE ads.entity_type = 'CAMPAIGN'
        AND ads.entity_id IN (
          SELECT c.id FROM campaigns c
          JOIN sellpages sp ON c.sellpage_id = sp.id
          WHERE sp.product_id = ${productId}::uuid
        )
        AND ads.stat_date >= ${dateFrom}
        AND ads.stat_date <= ${dateTo}
    ` as Array<{ adSpend: number; impressions: number; clicks: number }>;

    const adSpend = Number(adStatsRaw[0]?.adSpend ?? 0);
    const impressions = Number(adStatsRaw[0]?.impressions ?? 0);
    const clicks = Number(adStatsRaw[0]?.clicks ?? 0);
    const roas = adSpend > 0 ? revenue / adSpend : 0;
    const cpm = impressions > 0 ? (adSpend / impressions) * 1000 : 0;
    const cpc = clicks > 0 ? adSpend / clicks : 0;

    return {
      productId,
      productName,
      revenue: Math.round(revenue * 100) / 100,
      orders,
      returns,
      chargebackRate: Math.round(chargebackRate * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      adSpend: Math.round(adSpend * 100) / 100,
      impressions,
      clicks,
      cpm: Math.round(cpm * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
    };
  }

  // ─── GET /admin/analytics/overview ──────────────────────────────────────────

  async getOverview(): Promise<OverviewResponse> {
    const now = new Date();

    // Date ranges
    const today = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = endOfDay(yesterday);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [
      // Last 30 days totals
      last30Orders,
      last30Revenue,
      last30Customers,
      last30ActiveProducts,
      // Previous 30 days (for trend)
      prev30Revenue,
      // Today
      todayOrders,
      todayRevenue,
      // Yesterday
      yesterdayOrders,
      yesterdayRevenue,
      // Conversion data from SellpageStatsDaily
      conversionData,
    ] = await Promise.all([
      // Last 30 days order count
      this.prisma.order.count({
        where: {
          createdAt: { gte: thirtyDaysAgo, lte: now },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      // Last 30 days revenue
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: thirtyDaysAgo, lte: now },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { total: true },
      }),
      // Unique customers last 30 days
      this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT customer_email)::int as count
        FROM orders
        WHERE created_at >= ${thirtyDaysAgo}
          AND created_at <= ${now}
          AND status != 'CANCELLED'
      ` as Promise<Array<{ count: number }>>,
      // Active products (products with orders in last 30 days)
      this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT oi.product_id)::int as count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= ${thirtyDaysAgo}
          AND o.created_at <= ${now}
          AND o.status != 'CANCELLED'
          AND oi.product_id IS NOT NULL
      ` as Promise<Array<{ count: number }>>,
      // Previous 30 days revenue (for trend)
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { total: true },
      }),
      // Today orders
      this.prisma.order.count({
        where: {
          createdAt: { gte: today, lte: todayEnd },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      // Today revenue
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: today, lte: todayEnd },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { total: true },
      }),
      // Yesterday orders
      this.prisma.order.count({
        where: {
          createdAt: { gte: yesterday, lte: yesterdayEnd },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      // Yesterday revenue
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: yesterday, lte: yesterdayEnd },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { total: true },
      }),
      // Conversion rate from SellpageStatsDaily (last 30 days)
      this.prisma.sellpageStatsDaily.aggregate({
        where: {
          statDate: { gte: thirtyDaysAgo, lte: now },
        },
        _sum: {
          contentViews: true,
          purchases: true,
        },
      }),
    ]);

    const totalRevenue = Number(last30Revenue._sum.total ?? 0);
    const totalOrders = last30Orders;
    const totalCustomers = Number(last30Customers[0]?.count ?? 0);
    const activeProducts = Number(last30ActiveProducts[0]?.count ?? 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const revenueToday = Number(todayRevenue._sum.total ?? 0);
    const ordersToday = todayOrders;
    const revenueYesterday = Number(yesterdayRevenue._sum.total ?? 0);
    const ordersYesterday = yesterdayOrders;

    // Conversion rate: purchases / content_views * 100
    const totalContentViews = Number(conversionData._sum.contentViews ?? 0);
    const totalPurchases = Number(conversionData._sum.purchases ?? 0);
    const conversionRate = totalContentViews > 0
      ? (totalPurchases / totalContentViews) * 100
      : 0;

    // Revenue trend: % change vs previous 30 days
    const prevRevenue = Number(prev30Revenue._sum.total ?? 0);
    const revenueTrend = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : totalRevenue > 0
        ? 100
        : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalCustomers,
      conversionRate: Math.round(conversionRate * 100) / 100,
      activeProducts,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      revenueToday: Math.round(revenueToday * 100) / 100,
      ordersToday,
      revenueYesterday: Math.round(revenueYesterday * 100) / 100,
      ordersYesterday,
      revenueTrend: Math.round(revenueTrend * 100) / 100,
    };
  }
}
