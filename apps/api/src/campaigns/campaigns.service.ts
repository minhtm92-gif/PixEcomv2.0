import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateCampaignBatchDto } from './dto/create-campaign-batch.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { InlineBudgetDto } from '../ads-manager/dto/bulk-action.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Cursor helpers (keyset: createdAt DESC, id DESC) ─────────────────────────

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const sep = raw.lastIndexOf('|');
    if (sep === -1) return null;
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

// ─── Select shapes ────────────────────────────────────────────────────────────

const ADSET_SELECT = {
  id: true,
  campaignId: true,
  sellerId: true,
  externalAdsetId: true,
  name: true,
  status: true,
  deliveryStatus: true,
  optimizationGoal: true,
  targeting: true,
  createdAt: true,
  updatedAt: true,
} as const;

const AD_SELECT = {
  id: true,
  adsetId: true,
  sellerId: true,
  externalAdId: true,
  name: true,
  status: true,
  deliveryStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

const CAMPAIGN_SELECT = {
  id: true,
  sellerId: true,
  sellpageId: true,
  adAccountId: true,
  adStrategyId: true,
  externalCampaignId: true,
  name: true,
  budget: true,
  budgetType: true,
  status: true,
  deliveryStatus: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Full detail select including relations — used by launch/pause/resume to return
 *  the same shape as getCampaign(). */
const CAMPAIGN_DETAIL_SELECT = {
  ...CAMPAIGN_SELECT,
  sellpage: { select: { id: true, slug: true, domain: { select: { hostname: true } } } },
  adAccount: { select: { id: true, name: true, externalId: true } },
  adStrategy: { select: { id: true, name: true } },
  _count: { select: { adsets: true } },
} as const;

// ─── CampaignsService ─────────────────────────────────────────────────────────

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaService: MetaService,
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async createCampaign(sellerId: string, dto: CreateCampaignDto) {
    // Validate sellpage belongs to seller
    const sellpage = await this.prisma.sellpage.findFirst({
      where: { id: dto.sellpageId, sellerId },
      select: { id: true },
    });
    if (!sellpage) {
      throw new NotFoundException(`Sellpage ${dto.sellpageId} not found`);
    }

    // Validate adAccount: must exist, belong to seller, type=AD_ACCOUNT, isActive
    const adAccount = await this.prisma.fbConnection.findFirst({
      where: {
        id: dto.adAccountId,
        sellerId,
        connectionType: 'AD_ACCOUNT',
        isActive: true,
      },
      select: { id: true, externalId: true },
    });
    if (!adAccount) {
      throw new BadRequestException(
        `Ad account ${dto.adAccountId} not found or is not an active AD_ACCOUNT for this seller`,
      );
    }

    // Validate adStrategyId if provided
    if (dto.adStrategyId) {
      const strategy = await this.prisma.adStrategy.findFirst({
        where: { id: dto.adStrategyId, sellerId, isActive: true },
        select: { id: true },
      });
      if (!strategy) {
        throw new NotFoundException(`Ad strategy ${dto.adStrategyId} not found`);
      }
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        sellerId,
        sellpageId: dto.sellpageId,
        adAccountId: dto.adAccountId,
        adStrategyId: dto.adStrategyId ?? null,
        name: dto.name,
        budget: dto.budget,
        budgetType: dto.budgetType as any,
        // PAUSED = pre-launch state (externalCampaignId=null means "not yet pushed to Meta")
        status: 'PAUSED' as any,
        externalCampaignId: null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      select: CAMPAIGN_SELECT,
    });

    return mapCampaign(campaign);
  }

  // ─── BATCH CREATE ────────────────────────────────────────────────────────

  async createCampaignBatch(sellerId: string, dto: CreateCampaignBatchDto) {
    // Validate sellpage — fetch URL details for ad destination link
    const sellpage = await this.prisma.sellpage.findFirst({
      where: { id: dto.sellpageId, sellerId },
      select: {
        id: true,
        slug: true,
        domain: { select: { hostname: true } },
      },
    });
    if (!sellpage) {
      throw new NotFoundException(`Sellpage ${dto.sellpageId} not found`);
    }

    // Build sellpage URL + UTM params
    const baseUrl = sellpage.domain
      ? `https://${sellpage.domain.hostname}/${sellpage.slug}`
      : `/${sellpage.slug}`;

    // Resolve pixel external ID if pixelId connection was provided
    let pixelExternalId: string | null = null;
    if (dto.pixelId) {
      const pixel = await this.prisma.fbConnection.findFirst({
        where: { id: dto.pixelId, sellerId, connectionType: 'PIXEL', isActive: true },
        select: { externalId: true },
      });
      if (pixel) {
        pixelExternalId = pixel.externalId;
      } else {
        throw new BadRequestException('Facebook pixel not found or inactive');
      }
    }

    // Validate ad account
    const adAccount = await this.prisma.fbConnection.findFirst({
      where: { id: dto.adAccountId, sellerId, connectionType: 'AD_ACCOUNT', isActive: true },
      select: { id: true, externalId: true },
    });
    if (!adAccount) {
      throw new BadRequestException('Ad account not found or inactive');
    }

    // Validate page if provided
    if (dto.pageId) {
      const page = await this.prisma.fbConnection.findFirst({
        where: { id: dto.pageId, sellerId, connectionType: 'PAGE', isActive: true },
        select: { id: true },
      });
      if (!page) {
        throw new BadRequestException('Facebook page not found or inactive');
      }
    }

    // Create all campaigns, adsets, ads, and ad posts in a transaction
    const campaigns = await this.prisma.$transaction(async (tx) => {
      const results: Array<{ id: string; name: string; adsetsCount: number; adsCount: number }> = [];

      for (let ci = 0; ci < dto.count; ci++) {
        const campaignName = dto.count > 1
          ? `${dto.nameTemplate} #${ci + 1}`
          : dto.nameTemplate;

        // UTM params per campaign
        const utmParams = new URLSearchParams({
          utm_source: 'facebook',
          utm_medium: 'paid',
          utm_campaign: campaignName.replace(/\s+/g, '_').toLowerCase(),
          utm_content: `c${ci + 1}`,
        });
        const destinationUrl = baseUrl.startsWith('http')
          ? `${baseUrl}?${utmParams.toString()}`
          : baseUrl;

        const campaign = await tx.campaign.create({
          data: {
            sellerId,
            sellpageId: dto.sellpageId,
            adAccountId: dto.adAccountId,
            name: campaignName,
            budget: dto.budget,
            budgetType: dto.budgetType as any,
            status: 'PAUSED' as any,
            externalCampaignId: null,
          },
          select: { id: true, name: true },
        });

        let totalAds = 0;

        for (let si = 0; si < dto.adsetsPerCampaign; si++) {
          // Adset targeting: Conversion objective, Purchase event, Advantage+ targeting
          const targeting: Record<string, unknown> = {
            conversionEvent: 'PURCHASE',
            optimizationGoal: 'OFFSITE_CONVERSIONS',
            billingEvent: 'IMPRESSIONS',
            attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 1 }],
            destinationUrl,
          };
          if (pixelExternalId) {
            targeting.pixelId = pixelExternalId;
            targeting.promotedObject = {
              pixel_id: pixelExternalId,
              custom_event_type: 'PURCHASE',
            };
          }
          // Merge audience targeting (geo_locations, age_min, age_max, genders)
          if (dto.targeting) {
            Object.assign(targeting, dto.targeting);
          }

          const adset = await tx.adset.create({
            data: {
              campaignId: campaign.id,
              sellerId,
              name: `Adset ${si + 1}`,
              status: 'PAUSED' as any,
              optimizationGoal: 'OFFSITE_CONVERSIONS',
              targeting: targeting as any,
            },
            select: { id: true },
          });

          for (let ai = 0; ai < dto.adsPerAdset; ai++) {
            // Get creative config for this ad
            const creativeConfig = dto.adCreatives?.[ai] ?? null;

            const ad = await tx.ad.create({
              data: {
                adsetId: adset.id,
                sellerId,
                name: `Ad ${ai + 1}`,
                status: 'PAUSED' as any,
              },
              select: { id: true },
            });

            // Create AdPost if page is provided
            if (dto.pageId) {
              await tx.adPost.create({
                data: {
                  sellerId,
                  adId: ad.id,
                  pageId: dto.pageId,
                  postSource: 'CONTENT_SOURCE' as any,
                  externalPostId: null,
                },
              });
            }

            totalAds++;
          }
        }

        results.push({
          id: campaign.id,
          name: campaign.name,
          adsetsCount: dto.adsetsPerCampaign,
          adsCount: totalAds,
        });
      }

      return results;
    });

    // Auto-assign dataset (pixel) to sellpage if not already assigned
    if (pixelExternalId) {
      const current = await this.prisma.sellpage.findUnique({
        where: { id: dto.sellpageId },
        select: { headerConfig: true },
      });
      const hc = (current?.headerConfig as Record<string, unknown>) ?? {};
      if (!hc.pixelId || hc.pixelId !== pixelExternalId) {
        await this.prisma.sellpage.update({
          where: { id: dto.sellpageId },
          data: { headerConfig: { ...hc, pixelId: pixelExternalId } as any },
        });
        this.logger.log(
          `Auto-assigned dataset ${pixelExternalId} to sellpage ${dto.sellpageId}`,
        );
      }
    }

    this.logger.log(
      `Batch created ${campaigns.length} campaigns for seller ${sellerId} ` +
      `(${dto.adsetsPerCampaign} adsets × ${dto.adsPerAdset} ads each) ` +
      `destination: ${baseUrl}, pixel: ${pixelExternalId ?? 'none'}`,
    );

    return { campaigns, totalCampaigns: campaigns.length };
  }

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async listCampaigns(sellerId: string, query: ListCampaignsDto) {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    const andClauses: Record<string, unknown>[] = [{ sellerId }];

    if (query.sellpageId) {
      andClauses.push({ sellpageId: query.sellpageId });
    }
    if (query.status) {
      andClauses.push({ status: query.status });
    }
    if (cursorData) {
      andClauses.push({
        OR: [
          { createdAt: { lt: cursorData.createdAt } },
          {
            createdAt: { equals: cursorData.createdAt },
            id: { lt: cursorData.id },
          },
        ],
      });
    }

    const rows = await this.prisma.campaign.findMany({
      where: { AND: andClauses },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        ...CAMPAIGN_SELECT,
        sellpage: { select: { id: true, slug: true, domain: { select: { hostname: true } } } },
        adAccount: { select: { id: true, name: true, externalId: true } },
        _count: { select: { adsets: true } },
      },
    });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    const nextCursor =
      hasMore && rows.length > 0
        ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id)
        : null;

    return {
      items: rows.map((r) => ({
        ...mapCampaign(r),
        sellpage: r.sellpage
          ? { id: r.sellpage.id, slug: r.sellpage.slug, urlPreview: buildCampaignUrlPreview(r.sellpage.slug, r.sellpage.domain) }
          : null,
        adAccountName: r.adAccount?.name ?? null,
        adsetsCount: r._count.adsets,
      })),
      nextCursor,
    };
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  async getCampaign(sellerId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, sellerId },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return toCampaignDetail(campaign);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async updateCampaign(sellerId: string, campaignId: string, dto: UpdateCampaignDto) {
    await this.assertBelongsToSeller(sellerId, campaignId);

    const hasFields =
      dto.name !== undefined ||
      dto.budget !== undefined ||
      dto.budgetType !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined;

    if (!hasFields) {
      throw new BadRequestException('At least one field must be provided');
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.budgetType !== undefined && { budgetType: dto.budgetType as any }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return toCampaignDetail(updated);
  }

  // ─── LAUNCH ────────────────────────────────────────────────────────────────
  // Only campaigns that have NOT yet been pushed to Meta (externalCampaignId=null)
  // can be launched.

  async launchCampaign(sellerId: string, campaignId: string) {
    const campaign = await this.assertBelongsToSeller(sellerId, campaignId);

    if (campaign.externalCampaignId !== null) {
      throw new ConflictException(
        `Campaign ${campaignId} has already been launched (externalCampaignId: ${campaign.externalCampaignId})`,
      );
    }

    // Load FbConnection to get externalId (act_ identifier)
    const adAccount = await this.prisma.fbConnection.findUnique({
      where: { id: campaign.adAccountId },
      select: { id: true, externalId: true },
    });
    if (!adAccount) {
      throw new NotFoundException('Ad account connection not found');
    }

    // POST to Meta: act_{externalId}/campaigns
    const metaPath = `act_${adAccount.externalId}/campaigns`;
    const budgetCents = Math.round(Number(campaign.budget) * 100);
    const budgetField =
      campaign.budgetType === 'LIFETIME'
        ? { lifetime_budget: String(budgetCents) }
        : { daily_budget: String(budgetCents) };

    const metaPayload = {
      name: campaign.name,
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE',
      special_ad_categories: [] as string[],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      ...budgetField,
    };

    this.logger.log(
      `Launching campaign "${campaign.name}" → Meta path: ${metaPath}, payload: ${JSON.stringify(metaPayload)}`,
    );

    const metaResponse = await this.metaService.post<{ id: string }>(
      campaign.adAccountId,
      metaPath,
      metaPayload,
    );

    // Update local record: set externalCampaignId + status=ACTIVE
    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        externalCampaignId: metaResponse.id,
        status: 'ACTIVE' as any,
      },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    this.logger.log(`Campaign ${campaignId} launched. Meta ID: ${metaResponse.id}`);

    return toCampaignDetail(updated);
  }

  // ─── PAUSE ─────────────────────────────────────────────────────────────────

  async pauseCampaign(sellerId: string, campaignId: string) {
    const campaign = await this.assertBelongsToSeller(sellerId, campaignId);

    if (campaign.status !== 'ACTIVE') {
      throw new ConflictException(
        `Campaign ${campaignId} cannot be paused — current status: ${campaign.status}`,
      );
    }

    if (!campaign.externalCampaignId) {
      throw new ConflictException(
        `Campaign ${campaignId} has no Meta campaign ID. Launch it first.`,
      );
    }

    // Call Meta API first — only update local on success
    await this.metaService.post<{ success: boolean }>(
      campaign.adAccountId,
      campaign.externalCampaignId,
      { status: 'PAUSED' },
    );

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' as any },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return toCampaignDetail(updated);
  }

  // ─── RESUME ────────────────────────────────────────────────────────────────

  async resumeCampaign(sellerId: string, campaignId: string) {
    const campaign = await this.assertBelongsToSeller(sellerId, campaignId);

    if (campaign.status !== 'PAUSED') {
      throw new ConflictException(
        `Campaign ${campaignId} cannot be resumed — current status: ${campaign.status}`,
      );
    }

    if (!campaign.externalCampaignId) {
      throw new ConflictException(
        `Campaign ${campaignId} has no Meta campaign ID. Launch it first.`,
      );
    }

    // Call Meta API first — only update local on success
    await this.metaService.post<{ success: boolean }>(
      campaign.adAccountId,
      campaign.externalCampaignId,
      { status: 'ACTIVE' },
    );

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' as any },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return toCampaignDetail(updated);
  }

  // ─── BUDGET ────────────────────────────────────────────────────────────────

  /**
   * PATCH /campaigns/:id/budget
   * Inline budget edit. Graceful Meta sync (local update succeeds even if Meta fails).
   */
  async updateCampaignBudget(sellerId: string, campaignId: string, dto: InlineBudgetDto) {
    const campaign = await this.assertBelongsToSeller(sellerId, campaignId);

    if (dto.budget <= 0) {
      throw new BadRequestException('Budget must be greater than 0');
    }

    // Graceful Meta sync
    if (campaign.externalCampaignId) {
      try {
        const metaPayload: Record<string, unknown> =
          (dto.budgetType ?? 'DAILY') === 'DAILY'
            ? { daily_budget: Math.round(dto.budget * 100) }
            : { lifetime_budget: Math.round(dto.budget * 100) };
        await this.metaService.post(
          campaign.adAccountId,
          campaign.externalCampaignId,
          metaPayload,
        );
      } catch (err) {
        this.logger.warn(
          `Meta budget update failed for campaign ${campaignId}: ${(err as Error).message}`,
        );
      }
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        budget: dto.budget,
        ...(dto.budgetType !== undefined && { budgetType: dto.budgetType as any }),
      },
      select: CAMPAIGN_SELECT,
    });

    return mapCampaign(updated);
  }

  // ─── ADSET PAUSE / RESUME ──────────────────────────────────────────────────

  /**
   * PATCH /adsets/:id/pause
   * Inline pause — graceful Meta sync.
   */
  async pauseAdset(sellerId: string, adsetId: string): Promise<any> {
    const adset = await this.assertAdsetBelongsToSeller(sellerId, adsetId);

    if (adset.status !== 'ACTIVE') {
      throw new ConflictException(
        `Adset ${adsetId} cannot be paused — current status: ${adset.status}`,
      );
    }

    // Graceful Meta sync
    if (adset.externalAdsetId) {
      try {
        await this.metaService.post(adset.adAccountId, adset.externalAdsetId, { status: 'PAUSED' });
      } catch (err) {
        this.logger.warn(`Meta adset pause failed (${adsetId}): ${(err as Error).message}`);
      }
    }

    return this.prisma.adset.update({
      where: { id: adsetId },
      data: { status: 'PAUSED' as any },
      select: ADSET_SELECT,
    });
  }

  /**
   * PATCH /adsets/:id/resume
   * Inline resume — graceful Meta sync.
   */
  async resumeAdset(sellerId: string, adsetId: string): Promise<any> {
    const adset = await this.assertAdsetBelongsToSeller(sellerId, adsetId);

    if (adset.status !== 'PAUSED') {
      throw new ConflictException(
        `Adset ${adsetId} cannot be resumed — current status: ${adset.status}`,
      );
    }

    if (adset.externalAdsetId) {
      try {
        await this.metaService.post(adset.adAccountId, adset.externalAdsetId, { status: 'ACTIVE' });
      } catch (err) {
        this.logger.warn(`Meta adset resume failed (${adsetId}): ${(err as Error).message}`);
      }
    }

    return this.prisma.adset.update({
      where: { id: adsetId },
      data: { status: 'ACTIVE' as any },
      select: ADSET_SELECT,
    });
  }

  // ─── AD PAUSE / RESUME ────────────────────────────────────────────────────

  /**
   * PATCH /ads/:id/pause
   * Inline pause — graceful Meta sync.
   */
  async pauseAd(sellerId: string, adId: string) {
    const ad = await this.assertAdBelongsToSeller(sellerId, adId);

    if (ad.status !== 'ACTIVE') {
      throw new ConflictException(
        `Ad ${adId} cannot be paused — current status: ${ad.status}`,
      );
    }

    if (ad.externalAdId) {
      try {
        await this.metaService.post(ad.adAccountId, ad.externalAdId, { status: 'PAUSED' });
      } catch (err) {
        this.logger.warn(`Meta ad pause failed (${adId}): ${(err as Error).message}`);
      }
    }

    return this.prisma.ad.update({
      where: { id: adId },
      data: { status: 'PAUSED' as any },
      select: AD_SELECT,
    });
  }

  /**
   * PATCH /ads/:id/resume
   * Inline resume — graceful Meta sync.
   */
  async resumeAd(sellerId: string, adId: string) {
    const ad = await this.assertAdBelongsToSeller(sellerId, adId);

    if (ad.status !== 'PAUSED') {
      throw new ConflictException(
        `Ad ${adId} cannot be resumed — current status: ${ad.status}`,
      );
    }

    if (ad.externalAdId) {
      try {
        await this.metaService.post(ad.adAccountId, ad.externalAdId, { status: 'ACTIVE' });
      } catch (err) {
        this.logger.warn(`Meta ad resume failed (${adId}): ${(err as Error).message}`);
      }
    }

    return this.prisma.ad.update({
      where: { id: adId },
      data: { status: 'ACTIVE' as any },
      select: AD_SELECT,
    });
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  private async assertAdsetBelongsToSeller(sellerId: string, adsetId: string) {
    const adset = await this.prisma.adset.findFirst({
      where: { id: adsetId, sellerId },
      select: {
        id: true,
        status: true,
        externalAdsetId: true,
        campaign: { select: { adAccountId: true } },
      },
    });
    if (!adset) throw new NotFoundException(`Adset ${adsetId} not found`);
    return {
      id: adset.id,
      status: adset.status.toString(),
      externalAdsetId: adset.externalAdsetId,
      adAccountId: adset.campaign?.adAccountId ?? '',
    };
  }

  private async assertAdBelongsToSeller(sellerId: string, adId: string) {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, sellerId },
      select: {
        id: true,
        status: true,
        externalAdId: true,
        adset: { select: { campaign: { select: { adAccountId: true } } } },
      },
    });
    if (!ad) throw new NotFoundException(`Ad ${adId} not found`);
    return {
      id: ad.id,
      status: ad.status.toString(),
      externalAdId: ad.externalAdId,
      adAccountId: ad.adset?.campaign?.adAccountId ?? '',
    };
  }

  private async assertBelongsToSeller(sellerId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, sellerId },
      select: {
        id: true,
        sellerId: true,
        adAccountId: true,
        externalCampaignId: true,
        status: true,
        name: true,
        budget: true,
        budgetType: true,
      },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    return campaign;
  }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapCampaign(c: {
  id: string;
  sellerId: string;
  sellpageId: string | null;
  adAccountId: string;
  adStrategyId: string | null;
  externalCampaignId: string | null;
  name: string;
  budget: any;
  budgetType: any;
  status: any;
  deliveryStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const budgetNum = Number(c.budget);
  return {
    id: c.id,
    sellerId: c.sellerId,
    sellpageId: c.sellpageId ?? null,
    adAccountId: c.adAccountId,
    adStrategyId: c.adStrategyId ?? null,
    externalCampaignId: c.externalCampaignId ?? null,
    name: c.name,
    budget: budgetNum,
    budgetPerDay: budgetNum,
    budgetType: c.budgetType,
    platform: 'META' as const,
    status: c.status,
    deliveryStatus: c.deliveryStatus ?? null,
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function buildCampaignUrlPreview(
  slug: string,
  domain: { hostname: string } | null,
): string {
  if (domain) return `https://${domain.hostname}/${slug}`;
  return `/${slug}`;
}

/** Convert a full-detail query result (with relations) to the CampaignDetail shape. */
function toCampaignDetail(r: {
  sellpage?: { id: string; slug: string; domain: { hostname: string } | null } | null;
  adAccount?: { id: string; name: string; externalId: string } | null;
  adStrategy?: { id: string; name: string } | null;
  _count?: { adsets: number };
} & Parameters<typeof mapCampaign>[0]) {
  return {
    ...mapCampaign(r),
    sellpage: r.sellpage
      ? { id: r.sellpage.id, slug: r.sellpage.slug, urlPreview: buildCampaignUrlPreview(r.sellpage.slug, r.sellpage.domain) }
      : null,
    adAccountName: r.adAccount?.name ?? null,
    adStrategy: r.adStrategy ?? null,
    adsetsCount: r._count?.adsets ?? 0,
  };
}
