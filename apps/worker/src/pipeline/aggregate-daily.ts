import { PrismaClient } from '@pixecom/database';

/**
 * Aggregate ad_stats_raw → ad_stats_daily for a seller / level / date.
 *
 * Re-aggregates from ALL raw rows for the entity/date (idempotent).
 * Derived ratios (cpm, ctr, cpc, roas, costPerPurchase) are recomputed
 * from summed totals, never averaged.
 *
 * Returns the count of rows upserted.
 */
export async function aggregateDaily(
  prisma: PrismaClient,
  sellerId: string,
  level: 'CAMPAIGN' | 'ADSET' | 'AD',
  entityIds: string[],
  date: string, // YYYY-MM-DD
): Promise<number> {
  if (entityIds.length === 0) return 0;

  const statDate = new Date(`${date}T00:00:00.000Z`);

  // Aggregate from raw using groupBy
  const grouped = await prisma.adStatsRaw.groupBy({
    by: ['entityId', 'entityType'],
    where: {
      sellerId,
      entityType: level as any,
      entityId: { in: entityIds },
      dateStart: statDate,
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

  if (grouped.length === 0) return 0;

  let upsertCount = 0;

  for (const row of grouped) {
    const spend = Number(row._sum.spend ?? 0);
    const impressions = Number(row._sum.impressions ?? 0);
    const linkClicks = Number(row._sum.linkClicks ?? 0);
    const contentViews = Number(row._sum.contentViews ?? 0);
    const addToCart = Number(row._sum.addToCart ?? 0);
    const checkoutInitiated = Number(row._sum.checkoutInitiated ?? 0);
    const purchases = Number(row._sum.purchases ?? 0);
    const purchaseValue = Number(row._sum.purchaseValue ?? 0);

    // Re-derive ratios from summed totals
    const cpm = impressions > 0 ? round4(spend / impressions * 1000) : 0;
    const ctr = impressions > 0 ? round4(linkClicks / impressions) : 0;
    const cpc = linkClicks > 0 ? round4(spend / linkClicks) : 0;
    const costPerPurchase = purchases > 0 ? round4(spend / purchases) : 0;
    const roas = spend > 0 ? round4(purchaseValue / spend) : 0;

    const data = {
      sellerId,
      entityType: row.entityType,
      entityId: row.entityId,
      statDate,
      spend,
      impressions,
      linkClicks,
      contentViews,
      addToCart,
      checkoutInitiated,
      purchases,
      purchaseValue,
      cpm,
      ctr,
      cpc,
      costPerPurchase,
      roas,
    };

    await prisma.adStatsDaily.upsert({
      where: {
        uq_ad_stats_daily: {
          sellerId,
          entityType: row.entityType,
          entityId: row.entityId,
          statDate,
        },
      },
      create: data,
      update: {
        spend,
        impressions,
        linkClicks,
        contentViews,
        addToCart,
        checkoutInitiated,
        purchases,
        purchaseValue,
        cpm,
        ctr,
        cpc,
        costPerPurchase,
        roas,
      },
    });

    upsertCount++;
  }

  return upsertCount;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
