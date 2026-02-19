import { PrismaClient } from '@pixecom/database';

export interface CampaignEntity {
  id: string;
  externalId: string | null;
  budget: number;
  sellpageId: string;
}

export interface AdsetEntity {
  id: string;
  externalId: string | null;
  budget: number; // inherits from parent campaign budget
}

export interface AdEntity {
  id: string;
  externalId: string | null;
  budget: number; // inherits: adset budget / adCount
}

export interface SellerEntities {
  campaigns: CampaignEntity[];
  adsets: AdsetEntity[];
  ads: AdEntity[];
}

/**
 * Fetch all eligible sellers (those with active AD_ACCOUNT + active/paused campaign).
 */
export async function fetchEligibleSellerIds(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.campaign.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAUSED'] },
      adAccount: { isActive: true },
    },
    select: { sellerId: true },
    distinct: ['sellerId'],
  });
  return rows.map((r) => r.sellerId);
}

/**
 * Fetch all entities for a seller by level.
 */
export async function fetchSellerEntities(
  prisma: PrismaClient,
  sellerId: string,
): Promise<SellerEntities> {
  // ── Campaigns ──────────────────────────────────────────────────────────────
  const rawCampaigns = await prisma.campaign.findMany({
    where: {
      sellerId,
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
    select: {
      id: true,
      externalCampaignId: true,
      budget: true,
      budgetType: true,
      sellpageId: true,
    },
  });

  const campaigns: CampaignEntity[] = rawCampaigns.map((c) => ({
    id: c.id,
    externalId: c.externalCampaignId ?? null,
    // DAILY budget = full amount per day; LIFETIME = budget / 30 (simplified)
    budget: c.budgetType === 'DAILY'
      ? Number(c.budget)
      : Math.round((Number(c.budget) / 30) * 100) / 100,
    sellpageId: c.sellpageId,
  }));

  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  // ── Adsets ─────────────────────────────────────────────────────────────────
  const rawAdsets = await prisma.adset.findMany({
    where: { sellerId, campaign: { status: { in: ['ACTIVE', 'PAUSED'] } } },
    select: {
      id: true,
      externalAdsetId: true,
      campaignId: true,
      _count: { select: { ads: true } },
    },
  });

  // Count adsets per campaign for proportional budget split
  const adsetsPerCampaign = new Map<string, number>();
  for (const a of rawAdsets) {
    adsetsPerCampaign.set(a.campaignId, (adsetsPerCampaign.get(a.campaignId) ?? 0) + 1);
  }

  const adsets: AdsetEntity[] = rawAdsets.map((a) => {
    const campaignBudget = campaignMap.get(a.campaignId)?.budget ?? 0;
    const adsetCount = adsetsPerCampaign.get(a.campaignId) ?? 1;
    return {
      id: a.id,
      externalId: a.externalAdsetId ?? null,
      budget: Math.round((campaignBudget / adsetCount) * 100) / 100,
    };
  });

  const adsetBudgetMap = new Map(adsets.map((a) => [a.id, a.budget]));

  // ── Ads ────────────────────────────────────────────────────────────────────
  const rawAds = await prisma.ad.findMany({
    where: { sellerId, adset: { campaign: { status: { in: ['ACTIVE', 'PAUSED'] } } } },
    select: {
      id: true,
      externalAdId: true,
      adsetId: true,
    },
  });

  // Count ads per adset
  const adsPerAdset = new Map<string, number>();
  for (const ad of rawAds) {
    adsPerAdset.set(ad.adsetId, (adsPerAdset.get(ad.adsetId) ?? 0) + 1);
  }

  const ads: AdEntity[] = rawAds.map((ad) => {
    const adsetBudget = adsetBudgetMap.get(ad.adsetId) ?? 0;
    const adCount = adsPerAdset.get(ad.adsetId) ?? 1;
    return {
      id: ad.id,
      externalId: ad.externalAdId ?? null,
      budget: Math.round((adsetBudget / adCount) * 100) / 100,
    };
  });

  return { campaigns, adsets, ads };
}
