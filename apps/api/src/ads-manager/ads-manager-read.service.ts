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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Turn Prisma groupBy result (ad_stats_daily) into a keyed map.
 * Sums raw fields — never averages derived columns.
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

    // 3. Build response rows
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

    // 4. Summary row — aggregate raw then derive (never sum derived columns)
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

    // 3. Build response rows
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

    // 4. Summary
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

    // 3. Build response rows
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

    // 4. Summary
    const summaryRaw = aggregateSummary(statsMap);
    const summary = computeMetrics(summaryRaw);

    return { ads: rows, summary };
  }

  // ── Live Preview ─────────────────────────────────────────────────────────

  async getLivePreview(sellerId: string, sellpageId?: string) {
    // 10-minute sliding window (Shopify Live View style)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. PixelxLab events (CV, ATC, CO) in last 10 minutes
    const eventCounts = await this.prisma.storefrontEvent.groupBy({
      by: ['eventType'],
      where: {
        sellerId,
        ...(sellpageId ? { sellpageId } : {}),
        createdAt: { gte: tenMinAgo },
      },
      _count: true,
    });

    const evMap = Object.fromEntries(eventCounts.map(e => [e.eventType, e._count]));
    const contentViews = evMap['content_view'] || 0;
    const addToCart = evMap['add_to_cart'] || 0;
    const checkout = evMap['checkout'] || 0;

    // 2. Active visitors = unique sessions in last 10 minutes
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

    // 3. Purchases in last 10 minutes from Orders
    const purchaseData = await this.prisma.order.aggregate({
      where: {
        sellerId,
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        createdAt: { gte: tenMinAgo },
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

    // 6. Campaign breakdown — group storefront events by utm_campaign in 10-min window
    const campaignEvents = await this.prisma.storefrontEvent.groupBy({
      by: ['utmCampaign', 'eventType'],
      where: {
        sellerId,
        ...(sellpageId ? { sellpageId } : {}),
        createdAt: { gte: tenMinAgo },
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
      windowMinutes: 10,
    };
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
