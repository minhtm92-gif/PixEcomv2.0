import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OverviewQueryDto } from './dto/overview-query.dto';

// ─── Money constants (Phase 1 MVP) ────────────────────────────────────────────
// PricingRule has sellerTakePercent/holdPercent but is product-level (platform).
// SellerSettings does NOT have take/hold fields.
// → Use these module-level defaults until a seller-level settings column is added.
const DEFAULT_SELLER_TAKE_PERCENT = 0.70; // 70 %
const DEFAULT_HOLD_PERCENT = 0.30;        // 30 % of YouTake held
const DEFAULT_SOURCES = ['META'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiBlock {
  revenue: number;
  cost: number;
  youTake: number;
  hold: number;
  unhold: number;
  cashToBalance: number;
  roas: number;
  orders: number;
  purchases: number;
}

interface BySourceRow {
  source: string;
  spend: number;
  roas: number;
  clicks: number;
  purchases: number;
}

interface BySellpageRow {
  sellpage: { id: string; url: string };
  revenue: number;
  cost: number;
  youTake: number;
  hold: number;
  cashToBalance: number;
  roas: number;
  orders: number;
}

export interface OverviewResult {
  dateFrom: string;
  dateTo: string;
  kpis: KpiBlock;
  bySource: BySourceRow[];
  bySellpage: BySellpageRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function toDateEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function deriveMoney(revenue: number): { youTake: number; hold: number; unhold: number; cashToBalance: number } {
  const youTake = round2(revenue * DEFAULT_SELLER_TAKE_PERCENT);
  const hold = round2(youTake * DEFAULT_HOLD_PERCENT);
  const unhold = 0; // Phase 1: no unhold ledger
  const cashToBalance = round2(youTake - hold + unhold);
  return { youTake, hold, unhold, cashToBalance };
}

function buildSellpageUrl(slug: string, hostname: string | null | undefined): string {
  if (hostname) return `https://${hostname}/${slug}`;
  return `<unassigned-domain>/${slug}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(sellerId: string, query: OverviewQueryDto): Promise<OverviewResult> {
    const dateFrom = query.dateFrom ?? todayUTC();
    const dateTo = query.dateTo ?? todayUTC();
    const sources = query.includeSources?.length ? query.includeSources : DEFAULT_SOURCES;
    const sellpageFilter = query.sellpageId;

    // ── Date boundaries ──────────────────────────────────────────────────────
    const createdFrom = toDate(dateFrom);
    const createdTo = toDateEnd(dateTo);
    const statFrom = toDate(dateFrom);
    const statTo = toDate(dateTo);

    // ── Query 1: Orders aggregate (revenue + order count) ────────────────────
    // Group by sellpageId so we can build bySellpage in the same pass.
    const orderGroups = await this.prisma.order.groupBy({
      by: ['sellpageId'],
      where: {
        sellerId,
        ...(sellpageFilter ? { sellpageId: sellpageFilter } : {}),
        createdAt: { gte: createdFrom, lte: createdTo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    // ── Query 2: Spend + purchases from sellpage_stats_daily ─────────────────
    const spendGroups = await this.prisma.sellpageStatsDaily.groupBy({
      by: ['sellpageId', 'adSource'],
      where: {
        sellerId,
        ...(sellpageFilter ? { sellpageId: sellpageFilter } : {}),
        adSource: { in: sources },
        statDate: { gte: statFrom, lte: statTo },
      },
      _sum: {
        adSpend: true,
        purchases: true,
        linkClicks: true,
      },
    });

    // ── Query 3: Sellpage slug+domain for URL building ────────────────────────
    // Only fetch sellpages that actually appear in our results.
    const sellpageIds = new Set<string>();
    for (const g of orderGroups) if (g.sellpageId) sellpageIds.add(g.sellpageId);
    for (const g of spendGroups) sellpageIds.add(g.sellpageId);
    if (sellpageFilter) sellpageIds.add(sellpageFilter);

    const sellpages =
      sellpageIds.size > 0
        ? await this.prisma.sellpage.findMany({
            where: { id: { in: [...sellpageIds] }, sellerId },
            select: {
              id: true,
              slug: true,
              domain: { select: { hostname: true } },
            },
          })
        : [];

    const sellpageMap = new Map(
      sellpages.map((sp) => [
        sp.id,
        { id: sp.id, url: buildSellpageUrl(sp.slug, sp.domain?.hostname) },
      ]),
    );

    // ── Aggregate totals ─────────────────────────────────────────────────────
    let totalRevenue = 0;
    let totalOrders = 0;

    // Map<sellpageId, { revenue, orders }>
    const revenueByPage = new Map<string, { revenue: number; orders: number }>();
    for (const g of orderGroups) {
      const rev = Number(g._sum.total ?? 0);
      const cnt = g._count.id;
      totalRevenue += rev;
      totalOrders += cnt;
      const spId = g.sellpageId ?? '__none__';
      const prev = revenueByPage.get(spId) ?? { revenue: 0, orders: 0 };
      revenueByPage.set(spId, { revenue: prev.revenue + rev, orders: prev.orders + cnt });
    }

    let totalCost = 0;
    let totalPurchases = 0;

    // Map<sellpageId, { cost, purchases, clicks }>
    const costByPage = new Map<string, { cost: number; purchases: number; clicks: number }>();
    // Map<source, { spend, purchases, clicks }>
    const bySourceMap = new Map<string, { spend: number; purchases: number; clicks: number }>();

    for (const g of spendGroups) {
      const spend = Number(g._sum.adSpend ?? 0);
      const purchases = Number(g._sum.purchases ?? 0);
      const clicks = Number(g._sum.linkClicks ?? 0);
      totalCost += spend;
      totalPurchases += purchases;

      // by sellpage
      const prev = costByPage.get(g.sellpageId) ?? { cost: 0, purchases: 0, clicks: 0 };
      costByPage.set(g.sellpageId, {
        cost: prev.cost + spend,
        purchases: prev.purchases + purchases,
        clicks: prev.clicks + clicks,
      });

      // by source
      const src = bySourceMap.get(g.adSource) ?? { spend: 0, purchases: 0, clicks: 0 };
      bySourceMap.set(g.adSource, {
        spend: src.spend + spend,
        purchases: src.purchases + purchases,
        clicks: src.clicks + clicks,
      });
    }

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const money = deriveMoney(totalRevenue);
    const kpis: KpiBlock = {
      revenue: round2(totalRevenue),
      cost: round2(totalCost),
      youTake: money.youTake,
      hold: money.hold,
      unhold: money.unhold,
      cashToBalance: money.cashToBalance,
      roas: totalCost > 0 ? round4(totalRevenue / totalCost) : 0,
      orders: totalOrders,
      purchases: totalPurchases,
    };

    // ── bySource ─────────────────────────────────────────────────────────────
    const bySource: BySourceRow[] = [...bySourceMap.entries()].map(([source, s]) => ({
      source,
      spend: round2(s.spend),
      roas: s.spend > 0 ? round4(totalRevenue / s.spend) : 0,
      clicks: s.clicks,
      purchases: s.purchases,
    }));

    // ── bySellpage ────────────────────────────────────────────────────────────
    // Union of all sellpage IDs that appear in either orders or spend groups.
    const allPageIds = new Set([...revenueByPage.keys(), ...costByPage.keys()]);
    // Remove __none__ placeholder (orders with no sellpage association)
    allPageIds.delete('__none__');

    const bySellpage: BySellpageRow[] = [];
    for (const spId of allPageIds) {
      const rev = revenueByPage.get(spId)?.revenue ?? 0;
      const orders = revenueByPage.get(spId)?.orders ?? 0;
      const cost = costByPage.get(spId)?.cost ?? 0;
      const spMoney = deriveMoney(rev);
      const spInfo = sellpageMap.get(spId);
      if (!spInfo) continue; // defensive: skip if not found (cross-tenant guard)

      bySellpage.push({
        sellpage: spInfo,
        revenue: round2(rev),
        cost: round2(cost),
        youTake: spMoney.youTake,
        hold: spMoney.hold,
        cashToBalance: spMoney.cashToBalance,
        roas: cost > 0 ? round4(rev / cost) : 0,
        orders,
      });
    }

    // Sort bySellpage by revenue desc
    bySellpage.sort((a, b) => b.revenue - a.revenue);

    return {
      dateFrom,
      dateTo,
      kpis,
      bySource,
      bySellpage,
    };
  }

  /** Exposed for use in controller sync fallback. */
  todayUTC(): string {
    return todayUTC();
  }
}
