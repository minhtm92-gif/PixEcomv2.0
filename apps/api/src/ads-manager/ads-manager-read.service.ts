import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDateRange,
  computeMetrics,
  DEFAULT_PLATFORM,
  RawAdStats,
  safeDivide,
  zeroRaw,
} from './ads-manager.constants';
import { CampaignsQueryDto } from './dto/campaigns-query.dto';
import { AdsetsQueryDto } from './dto/adsets-query.dto';
import { AdsQueryDto } from './dto/ads-query.dto';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsMap {
  [entityId: string]: RawAdStats;
}

/** Storefront funnel counts keyed by campaign UUID */
interface StorefrontFunnel {
  contentViews: number;
  addToCart: number;
  checkoutInitiated: number;
  purchases: number;
  purchaseValue: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Turn Prisma groupBy result (ad_stats_daily) into a keyed map.
 * Sums raw fields — never averages derived columns.
 *
 * NOTE: contentViews, addToCart, checkoutInitiated, purchases from AdStatsDaily
 * reflect Meta-reported action values (from Meta Pixel).  Since PixEcom uses
 * its own storefront tracking, these Meta values are typically 0.
 * The caller must overlay real storefront funnel data after building the map.
 */
function buildStatsMap(
  rows: Array<{
    entityId: string;
    _sum: {
      spend: unknown;
      impressions: unknown;
      linkClicks: unknown;
      contentViews: unknown;
      addToCart: unknown;
      checkoutInitiated: unknown;
      purchases: unknown;
      purchaseValue: unknown;
    };
  }>,
): StatsMap {
  const map: StatsMap = {};
  for (const row of rows) {
    map[row.entityId] = {
      spend: Number(row._sum.spend ?? 0),
      impressions: Number(row._sum.impressions ?? 0),
      linkClicks: Number(row._sum.linkClicks ?? 0),
      contentViews: Number(row._sum.contentViews ?? 0),
      addToCart: Number(row._sum.addToCart ?? 0),
      checkoutInitiated: Number(row._sum.checkoutInitiated ?? 0),
      purchases: Number(row._sum.purchases ?? 0),
      purchaseValue: Number(row._sum.purchaseValue ?? 0),
    };
  }
  return map;
}

/**
 * Overlay storefront funnel data onto a StatsMap.
 * For each entity in the map, if storefrontData has funnel numbers for that
 * entity, replace the (typically-zero) Meta-reported values with real
 * PixEcom storefront event counts.
 *
 * Also handles entities that have storefront data but no AdStatsDaily row yet
 * (e.g. campaign has events but no spend recorded today).
 */
function overlayStorefrontData(
  statsMap: StatsMap,
  storefrontData: Map<string, StorefrontFunnel>,
): void {
  for (const [entityId, funnel] of storefrontData) {
    if (!statsMap[entityId]) {
      // Entity has storefront events but no ad stats row — create skeleton
      statsMap[entityId] = {
        ...zeroRaw(),
        contentViews: funnel.contentViews,
        addToCart: funnel.addToCart,
        checkoutInitiated: funnel.checkoutInitiated,
        purchases: funnel.purchases,
        purchaseValue: funnel.purchaseValue,
      };
    } else {
      // Replace Meta-reported funnel values with real storefront data
      statsMap[entityId].contentViews = funnel.contentViews;
      statsMap[entityId].addToCart = funnel.addToCart;
      statsMap[entityId].checkoutInitiated = funnel.checkoutInitiated;
      statsMap[entityId].purchases = funnel.purchases;
      statsMap[entityId].purchaseValue = funnel.purchaseValue;
    }
  }
}

/**
 * Aggregate all entries in a StatsMap into one summary RawAdStats.
 */
function aggregateSummary(map: StatsMap): RawAdStats {
  const total = zeroRaw();
  for (const raw of Object.values(map)) {
    total.spend += raw.spend;
    total.impressions += raw.impressions;
    total.linkClicks += raw.linkClicks;
    total.contentViews += raw.contentViews;
    total.addToCart += raw.addToCart;
    total.checkoutInitiated += raw.checkoutInitiated;
    total.purchases += raw.purchases;
    total.purchaseValue += raw.purchaseValue;
  }
  return total;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AdsManagerReadService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Storefront funnel helpers ─────────────────────────────────────────────

  /**
   * Query StorefrontEvent grouped by utmCampaign to get real funnel metrics
   * attributed to each campaign via UTM tracking.
   *
   * Returns a Map<campaignId, StorefrontFunnel>.
   *
   * The link: Facebook ad URL contains ?utm_campaign=<campaignId>
   * → storefront pages send this to the event tracking API
   * → StorefrontEvent.utmCampaign = campaign UUID.
   */
  private async getStorefrontFunnelByCampaign(
    sellerId: string,
    campaignIds: string[],
    dateRange: { gte?: Date; lte?: Date },
  ): Promise<Map<string, StorefrontFunnel>> {
    const result = new Map<string, StorefrontFunnel>();
    if (campaignIds.length === 0) return result;

    // Build date filter for createdAt (StorefrontEvent uses createdAt, not statDate)
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (dateRange.gte) createdAtFilter.gte = dateRange.gte;
    if (dateRange.lte) createdAtFilter.lte = dateRange.lte;

    // Query StorefrontEvent counting UNIQUE visitors (by ipHash) per campaign+event
    // This filters out Meta crawler bots that generate hundreds of events from one IP
    const dateWhere = Object.keys(createdAtFilter).length > 0
      ? `AND se."created_at" >= '${createdAtFilter.gte?.toISOString() ?? ''}' ${createdAtFilter.lte ? `AND se."created_at" <= '${createdAtFilter.lte.toISOString()}'` : ''}`
      : '';

    const eventRows: Array<{ utm_campaign: string; event_type: string; unique_count: string; total_value: string | null }> =
      await this.prisma.$queryRawUnsafe(`
        SELECT
          se."utm_campaign",
          se."event_type",
          COUNT(DISTINCT COALESCE(se."ip_hash", se."session_id", se."id"::text)) AS unique_count,
          SUM(se."value") AS total_value
        FROM "storefront_events" se
        WHERE se."seller_id" = '${sellerId}'
          AND se."utm_campaign" IN (${campaignIds.map(id => `'${id}'`).join(',')})
          ${dateWhere}
        GROUP BY se."utm_campaign", se."event_type"
      `);

    // Build funnel map from unique visitor counts
    for (const row of eventRows) {
      const cid = row.utm_campaign;
      if (!result.has(cid)) {
        result.set(cid, { contentViews: 0, addToCart: 0, checkoutInitiated: 0, purchases: 0, purchaseValue: 0 });
      }
      const funnel = result.get(cid)!;
      const count = Number(row.unique_count);
      switch (row.event_type) {
        case 'content_view':
          funnel.contentViews = count;
          break;
        case 'add_to_cart':
          funnel.addToCart = count;
          break;
        case 'checkout':
          funnel.checkoutInitiated = count;
          break;
        case 'purchase':
          funnel.purchases = count;
          funnel.purchaseValue = Number(row.total_value ?? 0);
          break;
      }
    }

    // Also get purchase revenue from confirmed orders attributed via utmCampaign
    // (Order.utmCampaign stores campaign UUID, same as StorefrontEvent)
    const orderRows = await this.prisma.order.groupBy({
      by: ['utmCampaign'],
      where: {
        sellerId,
        utmCampaign: { in: campaignIds },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        ...(Object.keys(createdAtFilter).length > 0
          ? { createdAt: createdAtFilter }
          : {}),
      },
      _sum: { total: true },
      _count: true,
    });

    for (const row of orderRows) {
      const cid = row.utmCampaign!;
      if (!result.has(cid)) {
        result.set(cid, { contentViews: 0, addToCart: 0, checkoutInitiated: 0, purchases: 0, purchaseValue: 0 });
      }
      const funnel = result.get(cid)!;
      // Use order data for purchases/revenue if it's higher (orders are more reliable for revenue)
      const orderRevenue = Number(row._sum.total ?? 0);
      if (orderRevenue > funnel.purchaseValue) {
        funnel.purchaseValue = orderRevenue;
      }
      if (row._count > funnel.purchases) {
        funnel.purchases = row._count;
      }
    }

    return result;
  }

  /**
   * For sub-campaign entities (adsets, ads), split the campaign-level storefront
   * funnel proportionally by each entity's share of ad spend.
   *
   * This is necessary because UTM tracking only has campaign-level granularity
   * (utm_campaign=campaignId). Adset/ad level attribution is approximated
   * using spend share.
   */
  private splitFunnelBySpend(
    campaignFunnel: Map<string, StorefrontFunnel>,
    entityToCampaign: Map<string, string>,
    entitySpend: Map<string, number>,
    campaignTotalSpend: Map<string, number>,
  ): Map<string, StorefrontFunnel> {
    const result = new Map<string, StorefrontFunnel>();

    for (const [entityId, campaignId] of entityToCampaign) {
      const funnel = campaignFunnel.get(campaignId);
      if (!funnel) continue;

      const totalSpend = campaignTotalSpend.get(campaignId) ?? 0;
      const mySpend = entitySpend.get(entityId) ?? 0;

      // Spend ratio: if no spend at all, distribute evenly
      let ratio: number;
      if (totalSpend > 0) {
        ratio = mySpend / totalSpend;
      } else {
        // Count entities in this campaign
        const siblingsInCampaign = [...entityToCampaign.values()].filter(c => c === campaignId).length;
        ratio = siblingsInCampaign > 0 ? 1 / siblingsInCampaign : 0;
      }

      result.set(entityId, {
        contentViews: Math.round(funnel.contentViews * ratio),
        addToCart: Math.round(funnel.addToCart * ratio),
        checkoutInitiated: Math.round(funnel.checkoutInitiated * ratio),
        purchases: Math.round(funnel.purchases * ratio),
        purchaseValue: Math.round(funnel.purchaseValue * ratio * 100) / 100,
      });
    }

    return result;
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  async getCampaigns(sellerId: string, userId: string, query: CampaignsQueryDto) {
    const dateRange = buildDateRange(query.dateFrom, query.dateTo);

    // Get this user's connected ad account IDs to scope campaigns
    // Include legacy unassigned connections (connectedByUserId=null) for backward compat
    const userAdAccounts = await this.prisma.fbConnection.findMany({
      where: {
        sellerId,
        OR: [
          { connectedByUserId: userId },
          { connectedByUserId: null },
        ],
        connectionType: 'AD_ACCOUNT',
        isActive: true,
      },
      select: { id: true },
    });
    const userAdAccountIds = userAdAccounts.map((a) => a.id);

    // 1. Fetch campaigns — only those linked to user's own ad accounts
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        sellerId,
        ...(userAdAccountIds.length > 0 ? { adAccountId: { in: userAdAccountIds } } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.adAccountId ? { adAccountId: query.adAccountId } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        deliveryStatus: true,
        budget: true,
        budgetType: true,
      },
      orderBy: { status: 'asc' },
    });

    if (campaigns.length === 0) {
      return { campaigns: [], summary: computeMetrics(zeroRaw()) };
    }

    const campaignIds = campaigns.map((c) => c.id);

    // 2. Fetch ad_stats_daily for all campaigns in range — sum raw counts
    //    (spend, impressions, clicks come from Meta; funnel metrics will be
    //     overlaid from StorefrontEvent below)
    const statRows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: {
        sellerId,
        entityType: 'CAMPAIGN',
        entityId: { in: campaignIds },
        ...(Object.keys(dateRange).length > 0
          ? { statDate: dateRange }
          : {}),
      },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
        contentViews: true,
        addToCart: true,
        checkoutInitiated: true,
        purchases: true,
        purchaseValue: true,
      },
    });

    const statsMap = buildStatsMap(statRows);

    // 3. Overlay real storefront funnel data from StorefrontEvent
    //    (replaces the typically-zero Meta-reported action values)
    const storefrontFunnel = await this.getStorefrontFunnelByCampaign(
      sellerId,
      campaignIds,
      dateRange,
    );
    overlayStorefrontData(statsMap, storefrontFunnel);

    // 4. Build response rows
    const rows = campaigns.map((c) => {
      const raw = statsMap[c.id] ?? zeroRaw();
      const metrics = computeMetrics(raw);
      return {
        id: c.id,
        name: c.name,
        platform: DEFAULT_PLATFORM,
        status: c.status,
        deliveryStatus: c.deliveryStatus ?? null,
        budgetPerDay:
          c.budgetType === 'DAILY' ? Number(c.budget) : null,
        ...metrics,
      };
    });

    // 5. Summary row — aggregate raw then derive (never sum derived columns)
    const summaryRaw = aggregateSummary(statsMap);
    const summary = computeMetrics(summaryRaw);

    return { campaigns: rows, summary };
  }

  // ── Adsets ─────────────────────────────────────────────────────────────────

  async getAdsets(sellerId: string, query: AdsetsQueryDto) {
    const dateRange = buildDateRange(query.dateFrom, query.dateTo);

    // 1. Fetch adsets — ensure campaign belongs to this seller via sellerId on adset
    const adsets = await this.prisma.adset.findMany({
      where: {
        sellerId,
        campaignId: query.campaignId,
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        deliveryStatus: true,
        optimizationGoal: true,
        campaignId: true,
      },
      orderBy: { status: 'asc' },
    });

    if (adsets.length === 0) {
      return { adsets: [], summary: computeMetrics(zeroRaw()) };
    }

    const adsetIds = adsets.map((a) => a.id);

    // 2. Fetch ad_stats_daily for all adsets in range
    const statRows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: {
        sellerId,
        entityType: 'ADSET',
        entityId: { in: adsetIds },
        ...(Object.keys(dateRange).length > 0
          ? { statDate: dateRange }
          : {}),
      },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
        contentViews: true,
        addToCart: true,
        checkoutInitiated: true,
        purchases: true,
        purchaseValue: true,
      },
    });

    const statsMap = buildStatsMap(statRows);

    // 3. Overlay storefront funnel data
    //    UTM tracking is at campaign level, so split campaign funnel proportionally
    //    by each adset's share of the campaign's total spend.
    const campaignId = query.campaignId;
    const campaignFunnel = await this.getStorefrontFunnelByCampaign(
      sellerId,
      [campaignId],
      dateRange,
    );

    if (campaignFunnel.size > 0) {
      // Build entity→campaign and spend maps for proportional splitting
      const entityToCampaign = new Map<string, string>();
      const entitySpend = new Map<string, number>();
      let totalCampaignSpend = 0;

      for (const adset of adsets) {
        entityToCampaign.set(adset.id, adset.campaignId);
        const spend = statsMap[adset.id]?.spend ?? 0;
        entitySpend.set(adset.id, spend);
        totalCampaignSpend += spend;
      }

      const campaignTotalSpend = new Map<string, number>();
      campaignTotalSpend.set(campaignId, totalCampaignSpend);

      const adsetFunnel = this.splitFunnelBySpend(
        campaignFunnel,
        entityToCampaign,
        entitySpend,
        campaignTotalSpend,
      );
      overlayStorefrontData(statsMap, adsetFunnel);
    }

    // 4. Build response rows
    const rows = adsets.map((a) => {
      const raw = statsMap[a.id] ?? zeroRaw();
      const metrics = computeMetrics(raw);
      return {
        id: a.id,
        campaignId: a.campaignId,
        name: a.name,
        platform: DEFAULT_PLATFORM,
        status: a.status,
        deliveryStatus: a.deliveryStatus ?? null,
        optimizationGoal: a.optimizationGoal ?? null,
        budgetPerDay: null, // Adset has no budget field in schema
        ...metrics,
      };
    });

    // 5. Summary
    const summaryRaw = aggregateSummary(statsMap);
    const summary = computeMetrics(summaryRaw);

    return { adsets: rows, summary };
  }

  // ── Ads ────────────────────────────────────────────────────────────────────

  async getAds(sellerId: string, query: AdsQueryDto) {
    const dateRange = buildDateRange(query.dateFrom, query.dateTo);

    // 1. Fetch ads — adset must belong to this seller (sellerId on ad)
    const ads = await this.prisma.ad.findMany({
      where: {
        sellerId,
        adsetId: query.adsetId,
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        deliveryStatus: true,
        adsetId: true,
        adset: {
          select: { campaignId: true },
        },
      },
      orderBy: { status: 'asc' },
    });

    if (ads.length === 0) {
      return { ads: [], summary: computeMetrics(zeroRaw()) };
    }

    const adIds = ads.map((a) => a.id);

    // 2. Fetch ad_stats_daily for all ads in range
    const statRows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: {
        sellerId,
        entityType: 'AD',
        entityId: { in: adIds },
        ...(Object.keys(dateRange).length > 0
          ? { statDate: dateRange }
          : {}),
      },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
        contentViews: true,
        addToCart: true,
        checkoutInitiated: true,
        purchases: true,
        purchaseValue: true,
      },
    });

    const statsMap = buildStatsMap(statRows);

    // 3. Overlay storefront funnel data
    //    UTM tracking is at campaign level. All ads in this adset share the same
    //    campaign. Split the campaign's funnel proportionally by each ad's spend.
    const campaignId = ads[0]?.adset.campaignId;
    if (campaignId) {
      const campaignFunnel = await this.getStorefrontFunnelByCampaign(
        sellerId,
        [campaignId],
        dateRange,
      );

      if (campaignFunnel.size > 0) {
        const entityToCampaign = new Map<string, string>();
        const entitySpend = new Map<string, number>();
        let totalCampaignSpend = 0;

        for (const ad of ads) {
          entityToCampaign.set(ad.id, ad.adset.campaignId);
          const spend = statsMap[ad.id]?.spend ?? 0;
          entitySpend.set(ad.id, spend);
          totalCampaignSpend += spend;
        }

        const campaignTotalSpend = new Map<string, number>();
        campaignTotalSpend.set(campaignId, totalCampaignSpend);

        const adFunnel = this.splitFunnelBySpend(
          campaignFunnel,
          entityToCampaign,
          entitySpend,
          campaignTotalSpend,
        );
        overlayStorefrontData(statsMap, adFunnel);
      }
    }

    // 4. Build response rows
    const rows = ads.map((a) => {
      const raw = statsMap[a.id] ?? zeroRaw();
      const metrics = computeMetrics(raw);
      return {
        id: a.id,
        adsetId: a.adsetId,
        campaignId: a.adset.campaignId,
        name: a.name,
        platform: DEFAULT_PLATFORM,
        status: a.status,
        deliveryStatus: a.deliveryStatus ?? null,
        budgetPerDay: null, // Ad has no budget field in schema
        ...metrics,
      };
    });

    // 5. Summary
    const summaryRaw = aggregateSummary(statsMap);
    const summary = computeMetrics(summaryRaw);

    return { ads: rows, summary };
  }

  // ── Live Preview ─────────────────────────────────────────────────────────

  async getLivePreview(sellerId: string, sellpageId?: string) {
    // Today since midnight — full-day view
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // Active visitors still uses 10-min sliding window (real-time indicator)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. PixelxLab events (CV, ATC, CO) since midnight — unique visitors by ipHash
    const eventRows: Array<{ event_type: string; unique_count: string }> =
      await this.prisma.$queryRawUnsafe(
        `SELECT
           event_type,
           COUNT(DISTINCT COALESCE(ip_hash, session_id, id::text)) AS unique_count
         FROM storefront_events
         WHERE seller_id = $1::uuid
           AND created_at >= $2
           ${sellpageId ? `AND sellpage_id = '${sellpageId}'` : ''}
         GROUP BY event_type`,
        sellerId,
        todayMidnight,
      );

    const evMap = Object.fromEntries(eventRows.map(e => [e.event_type, Number(e.unique_count)]));
    const contentViews = evMap['content_view'] || 0;
    const addToCart = evMap['add_to_cart'] || 0;
    const checkout = evMap['checkout'] || 0;

    // 2. Active visitors = unique sessions in last 10 minutes (real-time)
    const activeSessions = await this.prisma.storefrontEvent.findMany({
      where: {
        sellerId,
        ...(sellpageId ? { sellpageId } : {}),
        createdAt: { gte: tenMinAgo },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    const activeVisitors = activeSessions.filter(s => s.sessionId).length;

    // 3. Purchases since midnight from Orders
    const purchaseData = await this.prisma.order.aggregate({
      where: {
        sellerId,
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: todayMidnight },
        ...(sellpageId ? { sellpageId } : {}),
      },
      _count: true,
      _sum: { total: true },
    });
    const purchases = purchaseData._count;
    const revenue = Number(purchaseData._sum.total || 0);

    // 4. Facebook metrics — daily totals (Meta has no 10-min granularity)
    const today = new Date().toISOString().split('T')[0];
    const adStats = await this.prisma.adStatsDaily.findMany({
      where: {
        sellerId,
        entityType: 'CAMPAIGN',
        statDate: new Date(`${today}T00:00:00.000Z`),
      },
      select: {
        entityId: true,
        spend: true,
        impressions: true,
        linkClicks: true,
      },
    });

    const spend = adStats.reduce((sum, s) => sum + Number(s.spend || 0), 0);
    const impressions = adStats.reduce((sum, s) => sum + (s.impressions || 0), 0);
    const clicks = adStats.reduce((sum, s) => sum + (s.linkClicks || 0), 0);

    // 5. Compute metrics (NEVER average ratios — SUM raw then divide)
    const cr1 = safeDivide(checkout, contentViews) * 100;
    const cr2 = safeDivide(purchases, checkout) * 100;
    const cr = safeDivide(purchases, contentViews) * 100;
    const roas = safeDivide(revenue, spend);

    // 6. Campaign breakdown — group storefront events by utm_campaign since midnight
    const campaignEvents = await this.prisma.storefrontEvent.groupBy({
      by: ['utmCampaign', 'eventType'],
      where: {
        sellerId,
        ...(sellpageId ? { sellpageId } : {}),
        createdAt: { gte: todayMidnight },
        utmCampaign: { not: null },
      },
      _count: true,
    });

    // Merge with FB ad spend data — load campaign names
    const campaignIds = adStats.map(s => s.entityId);
    const campaigns = campaignIds.length > 0 ? await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true },
    }) : [];
    const fbCampaignMap = new Map(campaigns.map(c => [c.id, c.name]));

    // UTM uses campaign UUID → resolve to campaign name for display.
    // Collect all unique utm_campaign UUIDs from events to resolve names.
    const utmCampaignIds = [...new Set(
      campaignEvents.map(ce => ce.utmCampaign).filter((v): v is string => !!v && v !== ''),
    )];
    // Load campaign names for UTM IDs not already in fbCampaignMap
    const missingIds = utmCampaignIds.filter(id => !fbCampaignMap.has(id));
    if (missingIds.length > 0) {
      const extraCampaigns = await this.prisma.campaign.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, name: true },
      });
      for (const c of extraCampaigns) {
        fbCampaignMap.set(c.id, c.name);
      }
    }

    // Build campaign breakdown map — keyed by campaign NAME (resolved from UUID)
    const campaignMap = new Map<string, { cv: number; atc: number; co: number; po: number; id: string }>();
    for (const ce of campaignEvents) {
      const utmVal = ce.utmCampaign || '';
      if (utmVal === '') continue;
      // Resolve: if utm_campaign is a UUID that maps to a campaign name, use the name
      const displayName = fbCampaignMap.get(utmVal) || utmVal;
      if (!campaignMap.has(displayName)) campaignMap.set(displayName, { cv: 0, atc: 0, co: 0, po: 0, id: utmVal });
      const entry = campaignMap.get(displayName)!;
      if (ce.eventType === 'content_view') entry.cv = ce._count;
      else if (ce.eventType === 'add_to_cart') entry.atc = ce._count;
      else if (ce.eventType === 'checkout') entry.co = ce._count;
      else if (ce.eventType === 'purchase') entry.po = ce._count;
    }

    // Add FB campaigns with spend that have no storefront events yet
    for (const stat of adStats) {
      const name = fbCampaignMap.get(stat.entityId) || stat.entityId;
      if (!campaignMap.has(name)) campaignMap.set(name, { cv: 0, atc: 0, co: 0, po: 0, id: stat.entityId });
    }

    const byCampaign = Array.from(campaignMap.entries()).map(([name, stats]) => {
      // Find matching FB spend — match by campaign ID (stats.id) or by resolved name
      const fbStat = adStats.find(s =>
        s.entityId === stats.id || fbCampaignMap.get(s.entityId) === name,
      );
      const campSpend = Number(fbStat?.spend || 0);
      return {
        campaignName: name,
        contentViews: stats.cv,
        addToCart: stats.atc,
        checkout: stats.co,
        purchases: stats.po,
        spend: campSpend,
        revenue: 0, // would need per-campaign order data
        cr1: safeDivide(stats.co, stats.cv) * 100,
        cr2: safeDivide(stats.po, stats.co) * 100,
        cr: safeDivide(stats.po, stats.cv) * 100,
      };
    }).sort((a, b) => b.contentViews - a.contentViews);

    return {
      activeVisitors,
      totals: {
        contentViews, addToCart, checkout, purchases, revenue,
        spend, impressions, clicks,
        cr1, cr2, cr, roas,
      },
      byCampaign,
      updatedAt: new Date().toISOString(),
      windowMinutes: 0, // 0 = today (since midnight)
    };
  }

  // ── Daily Stats (Live Preview companion) ─────────────────────────────────

  /**
   * Returns per-day breakdown for the last N days.
   * Ad platform metrics (spend, impressions, clicks) from AdStatsDaily.
   * Funnel metrics (CV, ATC, CO, purchases) from StorefrontEvent.
   */
  async getDailyStats(sellerId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    // 1. Aggregate ad_stats_daily by statDate — ad platform metrics only
    const adRows = await this.prisma.adStatsDaily.groupBy({
      by: ['statDate'],
      where: {
        sellerId,
        entityType: 'CAMPAIGN',
        statDate: { gte: since },
      },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
      },
      orderBy: { statDate: 'desc' },
    });

    // 2. Query StorefrontEvent grouped by date for real funnel metrics
    const storefrontRows = await this.prisma.$queryRawUnsafe<
      Array<{ stat_date: Date; event_type: string; event_count: bigint; total_value: string }>
    >(
      `SELECT DATE(created_at) as stat_date, event_type, COUNT(*) as event_count,
              COALESCE(SUM(value), 0) as total_value
       FROM storefront_events
       WHERE seller_id = $1::uuid AND created_at >= $2
       GROUP BY DATE(created_at), event_type
       ORDER BY stat_date DESC`,
      sellerId,
      since,
    );

    // Build per-date funnel map
    const funnelByDate = new Map<string, { cv: number; atc: number; co: number; po: number; pv: number }>();
    for (const row of storefrontRows) {
      const dateKey = row.stat_date.toISOString().slice(0, 10);
      if (!funnelByDate.has(dateKey)) {
        funnelByDate.set(dateKey, { cv: 0, atc: 0, co: 0, po: 0, pv: 0 });
      }
      const f = funnelByDate.get(dateKey)!;
      switch (row.event_type) {
        case 'content_view': f.cv = Number(row.event_count); break;
        case 'add_to_cart': f.atc = Number(row.event_count); break;
        case 'checkout': f.co = Number(row.event_count); break;
        case 'purchase':
          f.po = Number(row.event_count);
          f.pv = parseFloat(row.total_value) || 0;
          break;
      }
    }

    // Also get order revenue per date (more reliable for purchase value)
    const orderRows = await this.prisma.$queryRawUnsafe<
      Array<{ stat_date: Date; order_count: bigint; total_revenue: string }>
    >(
      `SELECT DATE(created_at) as stat_date, COUNT(*) as order_count,
              COALESCE(SUM(total), 0) as total_revenue
       FROM orders
       WHERE seller_id = $1::uuid AND created_at >= $2
         AND status IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
       GROUP BY DATE(created_at)`,
      sellerId,
      since,
    );

    for (const row of orderRows) {
      const dateKey = row.stat_date.toISOString().slice(0, 10);
      if (!funnelByDate.has(dateKey)) {
        funnelByDate.set(dateKey, { cv: 0, atc: 0, co: 0, po: 0, pv: 0 });
      }
      const f = funnelByDate.get(dateKey)!;
      const rev = parseFloat(row.total_revenue) || 0;
      const cnt = Number(row.order_count);
      if (rev > f.pv) f.pv = rev;
      if (cnt > f.po) f.po = cnt;
    }

    // 3. Merge ad platform + storefront data per date
    // Collect all dates from both sources
    const allDates = new Set<string>();
    for (const row of adRows) {
      allDates.add(row.statDate.toISOString().slice(0, 10));
    }
    for (const dateKey of funnelByDate.keys()) {
      allDates.add(dateKey);
    }

    const adByDate = new Map(
      adRows.map((r) => [
        r.statDate.toISOString().slice(0, 10),
        {
          spend: Number(r._sum.spend ?? 0),
          impressions: Number(r._sum.impressions ?? 0),
          linkClicks: Number(r._sum.linkClicks ?? 0),
        },
      ]),
    );

    const daily = [...allDates]
      .sort((a, b) => b.localeCompare(a)) // desc
      .map((dateKey) => {
        const ad = adByDate.get(dateKey) ?? { spend: 0, impressions: 0, linkClicks: 0 };
        const funnel = funnelByDate.get(dateKey) ?? { cv: 0, atc: 0, co: 0, po: 0, pv: 0 };

        return {
          date: dateKey,
          spend: ad.spend,
          revenue: funnel.pv,
          contentViews: funnel.cv,
          addToCart: funnel.atc,
          checkout: funnel.co,
          purchases: funnel.po,
          roas: safeDivide(funnel.pv, ad.spend),
          cr1: safeDivide(funnel.co, funnel.cv) * 100,
          cr2: safeDivide(funnel.po, funnel.co) * 100,
          cr: safeDivide(funnel.po, funnel.cv) * 100,
        };
      });

    return { daily, days };
  }

  // ── Hourly Stats (Today's hourly breakdown) ─────────────────────────────

  /**
   * Returns per-hour breakdown for today (since midnight).
   * Funnel metrics (CV, ATC, CO, purchases) from StorefrontEvent grouped by hour.
   * Ad spend is daily granularity only, so returned as todaySpend in the response.
   */
  async getHourlyStats(sellerId: string) {
    const now = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);
    const currentHour = now.getHours();

    // 1. Get today's total ad spend from AdStatsDaily (daily granularity only)
    const today = now.toISOString().split('T')[0];
    const adStats = await this.prisma.adStatsDaily.aggregate({
      where: {
        sellerId,
        entityType: 'CAMPAIGN',
        statDate: new Date(`${today}T00:00:00.000Z`),
      },
      _sum: { spend: true },
    });
    const todaySpend = Number(adStats._sum.spend ?? 0);

    // 2. Query StorefrontEvent grouped by hour for today — count unique visitors by ipHash
    const storefrontRows = await this.prisma.$queryRawUnsafe<
      Array<{ hour_num: string; event_type: string; unique_count: string; total_value: string }>
    >(
      `SELECT
         EXTRACT(HOUR FROM created_at)::int AS hour_num,
         event_type,
         COUNT(DISTINCT COALESCE(ip_hash, session_id, id::text)) AS unique_count,
         COALESCE(SUM(value), 0) AS total_value
       FROM storefront_events
       WHERE seller_id = $1::uuid AND created_at >= $2
       GROUP BY EXTRACT(HOUR FROM created_at), event_type
       ORDER BY hour_num`,
      sellerId,
      todayMidnight,
    );

    // 3. Get order revenue per hour for today
    const orderRows = await this.prisma.$queryRawUnsafe<
      Array<{ hour_num: string; order_count: string; total_revenue: string }>
    >(
      `SELECT
         EXTRACT(HOUR FROM created_at)::int AS hour_num,
         COUNT(*) AS order_count,
         COALESCE(SUM(total), 0) AS total_revenue
       FROM orders
       WHERE seller_id = $1::uuid AND created_at >= $2
         AND status IN ('CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
       GROUP BY EXTRACT(HOUR FROM created_at)`,
      sellerId,
      todayMidnight,
    );

    // 4. Build per-hour funnel map
    const hourMap = new Map<number, { cv: number; atc: number; co: number; po: number; revenue: number }>();
    for (const row of storefrontRows) {
      const h = Number(row.hour_num);
      if (!hourMap.has(h)) hourMap.set(h, { cv: 0, atc: 0, co: 0, po: 0, revenue: 0 });
      const f = hourMap.get(h)!;
      const count = Number(row.unique_count);
      switch (row.event_type) {
        case 'content_view': f.cv = count; break;
        case 'add_to_cart': f.atc = count; break;
        case 'checkout': f.co = count; break;
        case 'purchase':
          f.po = count;
          f.revenue = parseFloat(row.total_value) || 0;
          break;
      }
    }

    // Overlay order data per hour (more reliable for revenue)
    for (const row of orderRows) {
      const h = Number(row.hour_num);
      if (!hourMap.has(h)) hourMap.set(h, { cv: 0, atc: 0, co: 0, po: 0, revenue: 0 });
      const f = hourMap.get(h)!;
      const rev = parseFloat(row.total_revenue) || 0;
      const cnt = Number(row.order_count);
      if (rev > f.revenue) f.revenue = rev;
      if (cnt > f.po) f.po = cnt;
    }

    // 5. Build hourly rows — only hours up to current hour, most recent first
    const hourly: Array<{
      hour: number;
      spend: number;
      revenue: number;
      contentViews: number;
      addToCart: number;
      checkout: number;
      purchases: number;
      roas: number;
      cr: number;
    }> = [];

    for (let h = currentHour; h >= 0; h--) {
      const f = hourMap.get(h) ?? { cv: 0, atc: 0, co: 0, po: 0, revenue: 0 };
      hourly.push({
        hour: h,
        spend: 0, // Ad spend is daily only — shown as todaySpend in header
        revenue: f.revenue,
        contentViews: f.cv,
        addToCart: f.atc,
        checkout: f.co,
        purchases: f.po,
        roas: 0, // No per-hour spend, so per-hour ROAS not meaningful
        cr: f.cv > 0 ? safeDivide(f.po, f.cv) * 100 : 0,
      });
    }

    return { hourly, todaySpend };
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  async getFilters(
    sellerId: string,
    campaignId?: string,
    adsetId?: string,
  ) {
    // Always return campaigns for this seller
    const campaigns = await this.prisma.campaign.findMany({
      where: { sellerId },
      select: { id: true, name: true, status: true },
      orderBy: { status: 'asc' },
    });

    // Adsets — only if campaignId provided
    let adsets: Array<{ id: string; name: string; status: string; campaignId: string }> = [];
    if (campaignId) {
      adsets = await this.prisma.adset.findMany({
        where: { sellerId, campaignId },
        select: { id: true, name: true, status: true, campaignId: true },
        orderBy: { status: 'asc' },
      });
    }

    // Ads — only if adsetId provided
    let ads: Array<{ id: string; name: string; status: string; adsetId: string }> = [];
    if (adsetId) {
      ads = await this.prisma.ad.findMany({
        where: { sellerId, adsetId },
        select: { id: true, name: true, status: true, adsetId: true },
        orderBy: { status: 'asc' },
      });
    }

    return {
      campaigns,
      adsets,
      ads,
      statusEnums: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT', 'COMPLETED'],
    };
  }
}
