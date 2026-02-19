import { PrismaClient } from '@pixecom/database';

const AD_SOURCE = 'META';

/**
 * Roll up campaign-level ad_stats_daily → sellpage_stats_daily.
 *
 * Triggered only by CAMPAIGN-level jobs.
 * Groups campaign daily stats by campaign.sellpageId, sums all metrics,
 * then upserts into sellpage_stats_daily.
 *
 * Returns the count of rows upserted.
 */
export async function rollupSellpage(
  prisma: PrismaClient,
  sellerId: string,
  campaignIds: string[],
  date: string, // YYYY-MM-DD
): Promise<number> {
  if (campaignIds.length === 0) return 0;

  const statDate = new Date(`${date}T00:00:00.000Z`);

  // Fetch campaign daily rows joined with campaign.sellpageId
  const dailyRows = await prisma.adStatsDaily.findMany({
    where: {
      sellerId,
      entityType: 'CAMPAIGN',
      entityId: { in: campaignIds },
      statDate,
    },
    select: {
      entityId: true,
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

  if (dailyRows.length === 0) return 0;

  // Fetch sellpageId for each campaign
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, sellpageId: true },
  });
  const sellpageMap = new Map(campaigns.map((c) => [c.id, c.sellpageId]));

  // Group by sellpageId
  const byPage = new Map<
    string,
    {
      spend: number;
      impressions: number;
      linkClicks: number;
      contentViews: number;
      addToCart: number;
      checkoutInitiated: number;
      purchases: number;
      purchaseValue: number;
    }
  >();

  for (const row of dailyRows) {
    const sellpageId = sellpageMap.get(row.entityId);
    if (!sellpageId) continue;

    const existing = byPage.get(sellpageId) ?? {
      spend: 0, impressions: 0, linkClicks: 0,
      contentViews: 0, addToCart: 0, checkoutInitiated: 0,
      purchases: 0, purchaseValue: 0,
    };

    byPage.set(sellpageId, {
      spend: existing.spend + Number(row.spend),
      impressions: existing.impressions + Number(row.impressions),
      linkClicks: existing.linkClicks + Number(row.linkClicks),
      contentViews: existing.contentViews + Number(row.contentViews),
      addToCart: existing.addToCart + Number(row.addToCart),
      checkoutInitiated: existing.checkoutInitiated + Number(row.checkoutInitiated),
      purchases: existing.purchases + Number(row.purchases),
      purchaseValue: existing.purchaseValue + Number(row.purchaseValue),
    });
  }

  let upsertCount = 0;

  for (const [sellpageId, agg] of byPage) {
    const {
      spend, impressions, linkClicks, contentViews,
      addToCart, checkoutInitiated, purchases, purchaseValue,
    } = agg;

    // Derived metrics
    const cpm = impressions > 0 ? round4(spend / impressions * 1000) : 0;
    const ctr = impressions > 0 ? round4(linkClicks / impressions) : 0;
    const costPerPurchase = purchases > 0 ? round4(spend / purchases) : 0;
    const roas = spend > 0 ? round4(purchaseValue / spend) : 0;

    // Conversion rates
    const cr1 = impressions > 0 ? round4(linkClicks / impressions) : 0;       // top-of-funnel
    const cr2 = linkClicks > 0 ? round4(purchases / linkClicks) : 0;           // click-to-purchase
    const cr3 = contentViews > 0 ? round4(purchases / contentViews) : 0;       // view-to-purchase

    const data = {
      sellerId,
      sellpageId,
      statDate,
      adSource: AD_SOURCE,
      revenue: purchaseValue,
      ordersCount: purchases,
      adSpend: spend,
      roas,
      cpm,
      ctr,
      linkClicks,
      contentViews,
      addToCart,
      checkoutInitiated,
      purchases,
      costPerPurchase,
      cr1,
      cr2,
      cr3,
    };

    await prisma.sellpageStatsDaily.upsert({
      where: {
        uq_sellpage_stats_daily: {
          sellerId,
          sellpageId,
          statDate,
          adSource: AD_SOURCE,
        },
      },
      create: data,
      update: {
        revenue: purchaseValue,
        ordersCount: purchases,
        adSpend: spend,
        roas,
        cpm,
        ctr,
        linkClicks,
        contentViews,
        addToCart,
        checkoutInitiated,
        purchases,
        costPerPurchase,
        cr1,
        cr2,
        cr3,
      },
    });

    upsertCount++;
  }

  return upsertCount;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
