import { PrismaClient } from '@pixecom/database';
import { RawStatRow } from '../providers/stat-provider.interface';

/**
 * Append raw stat rows to ad_stats_raw (append-only, no dedup).
 * Returns the count of rows inserted.
 */
export async function writeRaw(
  prisma: PrismaClient,
  rows: RawStatRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const result = await prisma.adStatsRaw.createMany({
    data: rows.map((r) => ({
      sellerId: r.sellerId,
      entityType: r.entityType as any,
      entityId: r.entityId,
      externalEntityId: r.externalEntityId,
      fetchedAt: r.fetchedAt,
      dateStart: r.dateStart,
      dateStop: r.dateStop,
      spend: r.spend,
      impressions: r.impressions,
      cpm: r.cpm,
      ctr: r.ctr,
      cpc: r.cpc,
      linkClicks: r.linkClicks,
      contentViews: r.contentViews,
      addToCart: r.addToCart,
      checkoutInitiated: r.checkoutInitiated,
      purchases: r.purchases,
      purchaseValue: r.purchaseValue,
      costPerPurchase: r.costPerPurchase,
      roas: r.roas,
    })),
  });

  return result.count;
}
