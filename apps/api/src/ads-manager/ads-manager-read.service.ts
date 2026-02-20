import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  aggregateAdSummary,
  aggregateStoreSummary,
  buildDateRange,
  computeMetrics,
  DEFAULT_PLATFORM,
  RawAdStats,
  zeroAdRaw,
  zeroStoreRaw,
} from './ads-manager.constants';
import { StoreMetricsService, StoreStatsMap } from './store-metrics.service';
import { CampaignsQueryDto } from './dto/campaigns-query.dto';
import { AdsetsQueryDto } from './dto/adsets-query.dto';
import { AdsQueryDto } from './dto/ads-query.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build ad stats map from groupBy result.
 * Sums raw counts per entityId — never averages derived columns.
 */
function buildAdStatsMap(
  rows: Array<{
    entityId: string;
    _sum: {
      spend: unknown;
      impressions: unknown;
      linkClicks: unknown;
    };
  }>,
): Record<string, RawAdStats> {
  const map: Record<string, RawAdStats> = {};
  for (const row of rows) {
    map[row.entityId] = {
      spend: Number(row._sum.spend ?? 0),
      impressions: Number(row._sum.impressions ?? 0),
      linkClicks: Number(row._sum.linkClicks ?? 0),
    };
  }
  return map;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AdsManagerReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeMetrics: StoreMetricsService,
  ) {}

  // ── Campaigns ──────────────────────────────────────────────────────────────

  async getCampaigns(sellerId: string, query: CampaignsQueryDto) {
    const dateRange = buildDateRange(query.dateFrom, query.dateTo);
    const dateFilter =
      Object.keys(dateRange).length > 0 ? { statDate: dateRange } : {};

    // 1. Fetch campaign entities
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        sellerId,
        ...(query.status ? { status: query.status as any } : {}),
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
      return {
        campaigns: [],
        summary: computeMetrics(zeroAdRaw(), zeroStoreRaw()),
      };
    }

    const ids = campaigns.map((c) => c.id);

    // 2. Ads-side: ad_stats_daily grouped by entityId — sum raw
    const adStatRows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: { sellerId, entityType: 'CAMPAIGN', entityId: { in: ids }, ...dateFilter },
      _sum: { spend: true, impressions: true, linkClicks: true },
    });
    const adMap = buildAdStatsMap(adStatRows);

    // 3. Store-side: store_entity_stats_daily — UTM-attributed orders
    const storeMap: StoreStatsMap = await this.storeMetrics.getStoreStatsMap(
      sellerId,
      'CAMPAIGN',
      ids,
      dateRange.gte,
      dateRange.lte,
    );

    // 4. Build response rows — join both sources
    const rows = campaigns.map((c) => {
      const ad = adMap[c.id] ?? zeroAdRaw();
      const store = storeMap[c.id] ?? zeroStoreRaw();
      return {
        id: c.id,
        name: c.name,
        platform: DEFAULT_PLATFORM,
        status: c.status,
        deliveryStatus: c.deliveryStatus ?? null,
        budgetPerDay: c.budgetType === 'DAILY' ? Number(c.budget) : null,
        ...computeMetrics(ad, store),
      };
    });

    // 5. Summary — aggregate raw first, then derive (never sum derived columns)
    const summary = computeMetrics(
      aggregateAdSummary(adMap),
      aggregateStoreSummary(storeMap),
    );

    return { campaigns: rows, summary };
  }

  // ── Adsets ─────────────────────────────────────────────────────────────────

  async getAdsets(sellerId: string, query: AdsetsQueryDto) {
    const dateRange = buildDateRange(query.dateFrom, query.dateTo);
    const dateFilter =
      Object.keys(dateRange).length > 0 ? { statDate: dateRange } : {};

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
      return {
        adsets: [],
        summary: computeMetrics(zeroAdRaw(), zeroStoreRaw()),
      };
    }

    const ids = adsets.map((a) => a.id);

    const adStatRows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: { sellerId, entityType: 'ADSET', entityId: { in: ids }, ...dateFilter },
      _sum: { spend: true, impressions: true, linkClicks: true },
    });
    const adMap = buildAdStatsMap(adStatRows);

    const storeMap = await this.storeMetrics.getStoreStatsMap(
      sellerId,
      'ADSET',
      ids,
      dateRange.gte,
      dateRange.lte,
    );

    const rows = adsets.map((a) => {
      const ad = adMap[a.id] ?? zeroAdRaw();
      const store = storeMap[a.id] ?? zeroStoreRaw();
      return {
        id: a.id,
        campaignId: a.campaignId,
        name: a.name,
        platform: DEFAULT_PLATFORM,
        status: a.status,
        deliveryStatus: a.deliveryStatus ?? null,
        optimizationGoal: a.optimizationGoal ?? null,
        budgetPerDay: null,
        ...computeMetrics(ad, store),
      };
    });

    const summary = computeMetrics(
      aggregateAdSummary(adMap),
      aggregateStoreSummary(storeMap),
    );

    return { adsets: rows, summary };
  }

  // ── Ads ────────────────────────────────────────────────────────────────────

  async getAds(sellerId: string, query: AdsQueryDto) {
    const dateRange = buildDateRange(query.dateFrom, query.dateTo);
    const dateFilter =
      Object.keys(dateRange).length > 0 ? { statDate: dateRange } : {};

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
        adset: { select: { campaignId: true } },
      },
      orderBy: { status: 'asc' },
    });

    if (ads.length === 0) {
      return {
        ads: [],
        summary: computeMetrics(zeroAdRaw(), zeroStoreRaw()),
      };
    }

    const ids = ads.map((a) => a.id);

    const adStatRows = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: { sellerId, entityType: 'AD', entityId: { in: ids }, ...dateFilter },
      _sum: { spend: true, impressions: true, linkClicks: true },
    });
    const adMap = buildAdStatsMap(adStatRows);

    const storeMap = await this.storeMetrics.getStoreStatsMap(
      sellerId,
      'AD',
      ids,
      dateRange.gte,
      dateRange.lte,
    );

    const rows = ads.map((a) => {
      const ad = adMap[a.id] ?? zeroAdRaw();
      const store = storeMap[a.id] ?? zeroStoreRaw();
      return {
        id: a.id,
        adsetId: a.adsetId,
        campaignId: a.adset.campaignId,
        name: a.name,
        platform: DEFAULT_PLATFORM,
        status: a.status,
        deliveryStatus: a.deliveryStatus ?? null,
        budgetPerDay: null,
        ...computeMetrics(ad, store),
      };
    });

    const summary = computeMetrics(
      aggregateAdSummary(adMap),
      aggregateStoreSummary(storeMap),
    );

    return { ads: rows, summary };
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  async getFilters(
    sellerId: string,
    campaignId?: string,
    adsetId?: string,
  ) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { sellerId },
      select: { id: true, name: true, status: true },
      orderBy: { status: 'asc' },
    });

    let adsets: Array<{ id: string; name: string; status: string; campaignId: string }> = [];
    if (campaignId) {
      adsets = await this.prisma.adset.findMany({
        where: { sellerId, campaignId },
        select: { id: true, name: true, status: true, campaignId: true },
        orderBy: { status: 'asc' },
      });
    }

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
      statusEnums: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'],
    };
  }
}
