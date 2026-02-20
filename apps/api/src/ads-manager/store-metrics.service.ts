import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// UTM prefix constants — must match what is written at order creation
export const UTM_CAMPAIGN_PREFIX = 'c_';
export const UTM_ADSET_PREFIX = 'as_';
export const UTM_AD_PREFIX = 'a_';

// 'N/A' sentinel — orders with this UTM are NOT attributed
export const UTM_NA = 'N/A';

export interface StoreRaw {
  contentViews: number;
  checkouts: number;
  purchases: number;
  revenue: number;
}

export interface StoreStatsMap {
  [entityId: string]: StoreRaw;
}

/**
 * StoreMetricsService
 *
 * Responsibilities:
 *  1. upsertFromOrders() — aggregate orders into store_entity_stats_daily via UTM attribution
 *  2. getStoreStatsMap() — read store_entity_stats_daily for a set of entity IDs in a date range
 *
 * UTM attribution rules:
 *  - utm_campaign = 'c_<campaignId>'  → CAMPAIGN level
 *  - utm_term     = 'as_<adsetId>'   → ADSET level
 *  - utm_content  = 'a_<adId>'       → AD level
 *  - utm = null or 'N/A'             → NOT attributed, excluded from rollups
 *
 * UTM N/A isolation:
 *  - Orders with utm_campaign = 'N/A' (or null) are skipped during rollup.
 *  - They are NEVER mixed into attributed entity stats.
 */
@Injectable()
export class StoreMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Re-aggregate orders for a seller over a date range and upsert
   * into store_entity_stats_daily for all 3 levels.
   *
   * Called by: stats worker (future), or triggered manually in tests.
   */
  async upsertFromOrders(
    sellerId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<void> {
    // Fetch all attributed, non-cancelled/refunded orders in range
    const orders = await this.prisma.order.findMany({
      where: {
        sellerId,
        createdAt: { gte: dateFrom, lte: dateTo },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        // Must have at least one UTM field that is not null and not 'N/A'
        OR: [
          { utmCampaign: { not: null } },
          { utmTerm: { not: null } },
          { utmContent: { not: null } },
        ],
      },
      select: {
        total: true,
        createdAt: true,
        utmCampaign: true,
        utmTerm: true,
        utmContent: true,
      },
    });

    // Accumulator: level + entityId + date → StoreRaw
    type Key = string; // `${level}|${entityId}|${dateStr}`
    const acc = new Map<Key, StoreRaw & { level: string; entityId: string; date: string }>();

    const toDate = (d: Date) => d.toISOString().slice(0, 10);

    const bump = (level: string, entityId: string, date: string, revenue: number) => {
      const key = `${level}|${entityId}|${date}`;
      const existing = acc.get(key) ?? { level, entityId, date, contentViews: 0, checkouts: 0, purchases: 0, revenue: 0 };
      existing.purchases += 1;
      existing.revenue += revenue;
      acc.set(key, existing);
    };

    for (const order of orders) {
      const date = toDate(order.createdAt);
      const rev = Number(order.total);

      // Campaign level — utm_campaign = 'c_<uuid>'
      if (
        order.utmCampaign &&
        order.utmCampaign !== UTM_NA &&
        order.utmCampaign.startsWith(UTM_CAMPAIGN_PREFIX)
      ) {
        const entityId = order.utmCampaign.slice(UTM_CAMPAIGN_PREFIX.length);
        bump('CAMPAIGN', entityId, date, rev);
      }

      // Adset level — utm_term = 'as_<uuid>'
      if (
        order.utmTerm &&
        order.utmTerm !== UTM_NA &&
        order.utmTerm.startsWith(UTM_ADSET_PREFIX)
      ) {
        const entityId = order.utmTerm.slice(UTM_ADSET_PREFIX.length);
        bump('ADSET', entityId, date, rev);
      }

      // Ad level — utm_content = 'a_<uuid>'
      if (
        order.utmContent &&
        order.utmContent !== UTM_NA &&
        order.utmContent.startsWith(UTM_AD_PREFIX)
      ) {
        const entityId = order.utmContent.slice(UTM_AD_PREFIX.length);
        bump('AD', entityId, date, rev);
      }
    }

    // Upsert all accumulated rows
    for (const row of acc.values()) {
      await this.prisma.storeEntityStatsDaily.upsert({
        where: {
          uq_store_entity_stats_daily: {
            sellerId,
            level: row.level,
            entityId: row.entityId,
            statDate: new Date(row.date),
          },
        },
        update: {
          purchases: row.purchases,
          revenue: row.revenue,
          updatedAt: new Date(),
        },
        create: {
          sellerId,
          platform: 'META',
          level: row.level,
          entityId: row.entityId,
          statDate: new Date(row.date),
          contentViews: row.contentViews,
          checkouts: row.checkouts,
          purchases: row.purchases,
          revenue: row.revenue,
        },
      });
    }
  }

  /**
   * Read store_entity_stats_daily for a set of entityIds at a given level,
   * optionally filtered by date range. Sums across dates.
   *
   * UTM N/A rows are never stored here — so this query is always clean.
   */
  async getStoreStatsMap(
    sellerId: string,
    level: 'CAMPAIGN' | 'ADSET' | 'AD',
    entityIds: string[],
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<StoreStatsMap> {
    if (entityIds.length === 0) return {};

    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const rows = await this.prisma.storeEntityStatsDaily.groupBy({
      by: ['entityId'],
      where: {
        sellerId,
        level,
        entityId: { in: entityIds },
        ...(Object.keys(dateFilter).length > 0 ? { statDate: dateFilter } : {}),
      },
      _sum: {
        contentViews: true,
        checkouts: true,
        purchases: true,
        revenue: true,
      },
    });

    const map: StoreStatsMap = {};
    for (const row of rows) {
      map[row.entityId] = {
        contentViews: Number(row._sum.contentViews ?? 0),
        checkouts: Number(row._sum.checkouts ?? 0),
        purchases: Number(row._sum.purchases ?? 0),
        revenue: Number(row._sum.revenue ?? 0),
      };
    }
    return map;
  }
}
