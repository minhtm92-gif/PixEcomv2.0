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

  async getLivePreview(sellerId: string, sellpageId?: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Get campaign-level stats for the target date
    //    If sellpageId provided, only include campaigns linked to that sellpage
    let scopedCampaignIds: string[] | undefined;

    if (sellpageId) {
      const scopedCampaigns = await this.prisma.campaign.findMany({
        where: { sellerId, sellpageId },
        select: { id: true },
      });
      scopedCampaignIds = scopedCampaigns.map((c) => c.id);
    }

    const campaignStats = await this.prisma.adStatsDaily.findMany({
      where: {
        sellerId,
        entityType: 'CAMPAIGN',
        statDate: new Date(`${targetDate}T00:00:00.000Z`),
        ...(scopedCampaignIds ? { entityId: { in: scopedCampaignIds } } : {}),
      },
      select: {
        entityId: true,
        contentViews: true,
        addToCart: true,
        checkoutInitiated: true,
        purchases: true,
        purchaseValue: true,
        spend: true,
      },
    });

    // 2. Aggregate totals — sum raw counts, NEVER average ratios
    const totals = campaignStats.reduce(
      (acc, s) => ({
        contentViews: acc.contentViews + (s.contentViews || 0),
        addToCart: acc.addToCart + (s.addToCart || 0),
        checkout: acc.checkout + (s.checkoutInitiated || 0),
        purchases: acc.purchases + (s.purchases || 0),
        spend: acc.spend + Number(s.spend || 0),
        revenue: acc.revenue + Number(s.purchaseValue || 0),
      }),
      { contentViews: 0, addToCart: 0, checkout: 0, purchases: 0, spend: 0, revenue: 0 },
    );

    // 3. Compute CRs from aggregated raw totals
    const cr1 = safeDivide(totals.checkout, totals.contentViews) * 100;
    const cr2 = safeDivide(totals.purchases, totals.checkout) * 100;
    const cr = safeDivide(totals.purchases, totals.contentViews) * 100;

    // 4. Campaign breakdown with names
    const campaignIds = campaignStats.map((s) => s.entityId);
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true },
    });
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

    const byCampaign = campaignStats
      .map((s) => {
        const cv = s.contentViews || 0;
        const atc = s.addToCart || 0;
        const co = s.checkoutInitiated || 0;
        const po = s.purchases || 0;
        return {
          campaignId: s.entityId,
          campaignName: campaignMap.get(s.entityId) || s.entityId,
          contentViews: cv,
          addToCart: atc,
          checkout: co,
          purchases: po,
          spend: Number(s.spend || 0),
          revenue: Number(s.purchaseValue || 0),
          cr1: safeDivide(co, cv) * 100,
          cr2: safeDivide(po, co) * 100,
          cr: safeDivide(po, cv) * 100,
        };
      })
      .sort((a, b) => b.contentViews - a.contentViews);

    return {
      totals: { ...totals, cr1, cr2, cr },
      byCampaign,
      updatedAt: new Date().toISOString(),
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
