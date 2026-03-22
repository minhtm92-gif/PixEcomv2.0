import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateCampaignBatchDto } from './dto/create-campaign-batch.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { InlineBudgetDto } from '../ads-manager/dto/bulk-action.dto';

// ─── Attribution spec builder (Advanced Mode) ────────────────────────────────

function buildAttributionSpec(model: { clickWindowDays?: number; viewWindowDays?: number }): object[] | undefined {
  const specs: object[] = [];
  if (model.clickWindowDays && model.clickWindowDays > 0) {
    specs.push({ event_type: 'CLICK_THROUGH', window_days: model.clickWindowDays });
  }
  if (model.viewWindowDays && model.viewWindowDays > 0) {
    specs.push({ event_type: 'VIEW_THROUGH', window_days: model.viewWindowDays });
  }
  return specs.length > 0 ? specs : undefined;
}

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
    private readonly config: ConfigService,
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
        seller: { select: { slug: true } },
      },
    });
    if (!sellpage) {
      throw new NotFoundException(`Sellpage ${dto.sellpageId} not found`);
    }

    // Build sellpage full URL (always absolute — required by Meta)
    let baseUrl: string;
    if (sellpage.domain) {
      baseUrl = `https://${sellpage.domain.hostname}/${sellpage.slug}`;
    } else {
      const frontendUrl = (
        this.config.get<string>('FRONTEND_URL') ?? 'https://pixecom.pixelxlab.com'
      ).replace(/\/$/, '');
      const sellerSlug = sellpage.seller?.slug ?? 'store';
      baseUrl = `${frontendUrl}/${sellerSlug}/${sellpage.slug}`;
    }

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

    // ── Resolve Creative IDs → actual URLs/text before transaction ─────
    // Creative IDs from wizard map to the Creative model, which stores
    // media as CreativeAsset→Asset (url) and text as metadata.content.
    const resolvedCreatives: Array<Record<string, unknown>> = [];
    if (dto.adCreatives?.length) {
      // Collect all unique Creative IDs
      const allCreativeIds = new Set<string>();
      for (const ac of dto.adCreatives) {
        if (ac.videoId) allCreativeIds.add(ac.videoId);
        if (ac.thumbnailId) allCreativeIds.add(ac.thumbnailId);
        if (ac.adtextId) allCreativeIds.add(ac.adtextId);
        if (ac.headlineId) allCreativeIds.add(ac.headlineId);
        if (ac.descriptionId) allCreativeIds.add(ac.descriptionId);
      }

      // Bulk-load all creatives with their assets
      const creativeRows = allCreativeIds.size > 0
        ? await this.prisma.creative.findMany({
            where: { id: { in: [...allCreativeIds] }, sellerId },
            select: {
              id: true,
              creativeType: true,
              metadata: true,
              assets: {
                select: {
                  role: true,
                  asset: { select: { url: true, mediaType: true } },
                },
              },
            },
          })
        : [];

      const creativeMap = new Map(creativeRows.map((c) => [c.id, c]));

      // Resolve each ad's creative config
      for (const ac of dto.adCreatives) {
        const resolved: Record<string, unknown> = {
          adFormat: ac.adFormat,
        };

        // Video: Creative → CreativeAsset (PRIMARY_VIDEO) → Asset.url
        if (ac.videoId) {
          const vc = creativeMap.get(ac.videoId);
          const videoAsset = vc?.assets?.find(
            (a) => a.role === 'PRIMARY_VIDEO',
          );
          if (videoAsset?.asset?.url) {
            resolved.videoUrl = videoAsset.asset.url;
            resolved.videoMediaType = videoAsset.asset.mediaType;
          }
        }

        // Thumbnail: Creative → CreativeAsset (THUMBNAIL) → Asset.url
        if (ac.thumbnailId) {
          const tc = creativeMap.get(ac.thumbnailId);
          const thumbAsset = tc?.assets?.find(
            (a) => a.role === 'THUMBNAIL',
          );
          if (thumbAsset?.asset?.url) {
            resolved.thumbnailUrl = thumbAsset.asset.url;
          }
        }

        // Adtext: Creative.metadata.content
        if (ac.adtextId) {
          const atc = creativeMap.get(ac.adtextId);
          const meta = atc?.metadata as Record<string, unknown> | null;
          if (meta?.content) resolved.primaryText = meta.content;
        }

        // Headline: Creative.metadata.content
        if (ac.headlineId) {
          const hc = creativeMap.get(ac.headlineId);
          const meta = hc?.metadata as Record<string, unknown> | null;
          if (meta?.content) resolved.headline = meta.content;
        }

        // Description: Creative.metadata.content
        if (ac.descriptionId) {
          const dc = creativeMap.get(ac.descriptionId);
          const meta = dc?.metadata as Record<string, unknown> | null;
          if (meta?.content) resolved.description = meta.content;
        }

        resolvedCreatives.push(resolved);
      }
    }

    // Create all campaigns, adsets, ads, and ad posts in a transaction
    const campaigns = await this.prisma.$transaction(async (tx) => {
      const results: Array<{ id: string; name: string; adsetsCount: number; adsCount: number }> = [];

      for (let ci = 0; ci < dto.count; ci++) {
        const campaignName = dto.count > 1
          ? `${dto.nameTemplate} #${ci + 1}`
          : dto.nameTemplate;

        // Destination URL: clean base URL (UTMs are added per-ad at launch time)
        const destinationUrl = baseUrl;

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
            optimizationGoal: dto.advancedMode && dto.performanceGoal
              ? dto.performanceGoal
              : 'OFFSITE_CONVERSIONS',
            billingEvent: 'IMPRESSIONS',
            attributionSpec: dto.advancedMode && dto.attributionModel
              ? buildAttributionSpec(dto.attributionModel)
              : [{ event_type: 'CLICK_THROUGH', window_days: 1 }],
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

          // Schedule: pass through ISO8601 times for Meta API
          if (dto.startTime) targeting.startTime = dto.startTime;
          if (dto.endTime) targeting.endTime = dto.endTime;
          if (dto.scheduleTimezone) targeting.scheduleTimezone = dto.scheduleTimezone;

          const adset = await tx.adset.create({
            data: {
              campaignId: campaign.id,
              sellerId,
              name: `Adset ${si + 1}`,
              status: 'PAUSED' as any,
              optimizationGoal: dto.advancedMode && dto.performanceGoal
                ? dto.performanceGoal
                : 'OFFSITE_CONVERSIONS',
              targeting: targeting as any,
            },
            select: { id: true },
          });

          for (let ai = 0; ai < dto.adsPerAdset; ai++) {
            const ad = await tx.ad.create({
              data: {
                adsetId: adset.id,
                sellerId,
                name: `Ad ${ai + 1}`,
                status: 'PAUSED' as any,
              },
              select: { id: true },
            });

            // Create AdPost with resolved creative config
            if (dto.pageId) {
              const creativeConfig = resolvedCreatives[ai] ?? {};

              await tx.adPost.create({
                data: {
                  sellerId,
                  adId: ad.id,
                  pageId: dto.pageId,
                  postSource: 'CONTENT_SOURCE' as any,
                  externalPostId: null,
                  creativeConfig: creativeConfig as any,
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

  async listCampaigns(sellerId: string, userId: string, query: ListCampaignsDto) {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursorData = query.cursor ? decodeCursor(query.cursor) : null;

    // Scope to user's own ad accounts (+ legacy unassigned for backward compat)
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

    const andClauses: Record<string, unknown>[] = [{ sellerId }];
    if (userAdAccountIds.length > 0) {
      andClauses.push({ adAccountId: { in: userAdAccountIds } });
    }

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
  // can be launched. Creates campaign + adsets + ads on Meta.

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

    const actId = `act_${adAccount.externalId}`;

    // ── Step 1: Create campaign on Meta ─────────────────────────────────────
    const budgetCents = Math.round(Number(campaign.budget) * 100);
    const budgetField =
      campaign.budgetType === 'LIFETIME'
        ? { lifetime_budget: String(budgetCents) }
        : { daily_budget: String(budgetCents) };

    const metaPayload = {
      name: campaign.name,
      objective: 'OUTCOME_SALES',
<<<<<<< HEAD
      status: campaign.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
=======
      status: 'ACTIVE',
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
      special_ad_categories: [] as string[],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      ...budgetField,
    };

    this.logger.log(
      `Launching campaign "${campaign.name}" → ${actId}/campaigns, payload: ${JSON.stringify(metaPayload)}`,
    );

    const metaCampaign = await this.metaService.post<{ id: string }>(
      campaign.adAccountId,
      `${actId}/campaigns`,
      metaPayload,
    );

    // Update local campaign with Meta ID
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        externalCampaignId: metaCampaign.id,
<<<<<<< HEAD
        status: campaign.status as any,
=======
        status: 'ACTIVE' as any,
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
      },
    });

    this.logger.log(`Campaign → Meta ID: ${metaCampaign.id}`);

    // ── Step 2: Load adsets + ads + ad posts (with creativeConfig) ───────
    const adsets = await this.prisma.adset.findMany({
      where: { campaignId, sellerId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        targeting: true,
        optimizationGoal: true,
        ads: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            adPosts: {
              take: 1,
              select: {
                id: true,
                postSource: true,
                externalPostId: true,
                creativeConfig: true,
                page: { select: { externalId: true } },
                assetMedia: { select: { url: true, mediaType: true } },
                assetThumbnail: { select: { url: true } },
                assetAdtext: {
                  select: { primaryText: true, headline: true, description: true },
                },
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Found ${adsets.length} adsets to push to Meta for campaign ${campaignId}`,
    );

    // ── Step 3+4: Create adsets + ads on Meta in background ───────────────
    // Fire-and-forget: process adsets/ads asynchronously so the HTTP
    // response returns quickly. Prevents frontend 30s timeout.
    this.pushAdsetsAndAds(
      campaign.adAccountId,
      campaignId,
      actId,
      metaCampaign.id,
      adsets,
      campaign.status,
    ).catch((err) =>
      this.logger.error(
        `Background pushAdsetsAndAds failed for campaign ${campaignId}: ${(err as Error).message}`,
      ),
    );

    // Return immediately — campaign is created on Meta, adsets/ads are processing
    const updated = await this.prisma.campaign.findFirst({
      where: { id: campaignId },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return toCampaignDetail(updated!);
  }

  /**
   * Background worker: push adsets + ads to Meta.
   * Called fire-and-forget from launchCampaign() to avoid HTTP timeout.
   */
  private async pushAdsetsAndAds(
    adAccountId: string,
    campaignId: string,
    actId: string,
    metaCampaignId: string,
    adsets: Array<{
      id: string;
      name: string;
      targeting: unknown;
      optimizationGoal: string | null;
      ads: Array<{
        id: string;
        name: string;
        adPosts: Array<{
          id: string;
          postSource: string;
          externalPostId: string | null;
          creativeConfig: unknown;
          page: { externalId: string } | null;
          assetMedia: { url: string; mediaType: string } | null;
          assetThumbnail: { url: string } | null;
          assetAdtext: { primaryText: string | null; headline: string | null; description: string | null } | null;
        }>;
      }>;
    }>,
    campaignStatus: string,
  ): Promise<void> {
    // ── BUG-025 fix: deduplicate video uploads ──────────────────────────
    // Collect all unique video URLs across every ad in every adset,
    // upload each video ONCE, then pass the map to pushSingleAd().
    const videoUrlMap = new Map<string, string>(); // videoUrl → metaVideoId

    for (const adset of adsets) {
      for (const ad of adset.ads) {
        const adPost = ad.adPosts?.[0];
        if (!adPost) continue;

        const cc = (adPost.creativeConfig ?? {}) as Record<string, unknown>;
        const videoUrl = (cc.videoUrl as string) || null;
        const isVideoAd =
          cc.adFormat === 'VIDEO_AD' ||
          (videoUrl !== null) ||
          adPost.assetMedia?.mediaType === 'VIDEO';

        if (isVideoAd) {
          const videoSrc = videoUrl || adPost.assetMedia?.url;
          if (videoSrc && !videoUrlMap.has(videoSrc)) {
            videoUrlMap.set(videoSrc, ''); // placeholder
          }
        }
      }
    }

    // Upload each unique video once
    for (const [url] of videoUrlMap) {
      try {
        this.logger.log(`Uploading unique video (dedup): ${url}`);
        const videoUpload = await this.metaService.post<{ id: string }>(
          adAccountId,
          `${actId}/advideos`,
          { file_url: url },
        );
        videoUrlMap.set(url, videoUpload.id);
        this.logger.log(`Video uploaded → Meta video ID: ${videoUpload.id}`);
      } catch (err) {
        this.logger.error(
          `Failed to upload video ${url}: ${(err as Error).message}`,
        );
        // Remove from map so pushSingleAd will skip it gracefully
        videoUrlMap.delete(url);
      }
    }

    this.logger.log(
      `Video dedup: ${videoUrlMap.size} unique videos uploaded for campaign ${campaignId}`,
    );
    // ── End BUG-025 fix ─────────────────────────────────────────────────

    let adsetsPushed = 0;
    let adsPushed = 0;

    for (const adset of adsets) {
      try {
        const targeting = (adset.targeting ?? {}) as Record<string, unknown>;

        // Build Meta targeting spec (audience fields only)
        const metaTargeting: Record<string, unknown> = {};
        if (targeting.geo_locations)
          metaTargeting.geo_locations = targeting.geo_locations;
        if (targeting.age_min !== undefined)
          metaTargeting.age_min = targeting.age_min;
        if (targeting.age_max !== undefined)
          metaTargeting.age_max = targeting.age_max;
        if (targeting.genders) metaTargeting.genders = targeting.genders;

        // Build adset payload
        const adsetPayload: Record<string, unknown> = {
          campaign_id: metaCampaignId,
          name: adset.name,
          optimization_goal:
            (targeting.optimizationGoal as string) || 'OFFSITE_CONVERSIONS',
          billing_event:
            (targeting.billingEvent as string) || 'IMPRESSIONS',
          status: 'ACTIVE', // Adsets always ACTIVE — campaign-level PAUSED controls delivery
          targeting: JSON.stringify(metaTargeting),
        };

        // Schedule: start_time / end_time for the adset
        if (targeting.startTime) {
          adsetPayload.start_time = targeting.startTime;
        }
        if (targeting.endTime) {
          adsetPayload.end_time = targeting.endTime;
        }

        // promoted_object required for conversion campaigns
        if (targeting.promotedObject) {
          adsetPayload.promoted_object = JSON.stringify(
            targeting.promotedObject,
          );
        }

        // attribution_spec
        if (targeting.attributionSpec) {
          adsetPayload.attribution_spec = JSON.stringify(
            targeting.attributionSpec,
          );
        }

        this.logger.log(
          `Creating adset "${adset.name}" on Meta: ${JSON.stringify(adsetPayload)}`,
        );

        const metaAdset = await this.metaService.post<{ id: string }>(
          adAccountId,
          `${actId}/adsets`,
          adsetPayload,
        );

        // Update local adset
        await this.prisma.adset.update({
          where: { id: adset.id },
          data: {
            externalAdsetId: metaAdset.id,
            status: campaignStatus as any,
          },
        });

        this.logger.log(`Adset "${adset.name}" → Meta ID: ${metaAdset.id}`);
        adsetsPushed++;

        // ── Create ads in parallel within this adset ──────────────────────
        const adResults = await Promise.allSettled(
          adset.ads.map((ad) =>
            this.pushSingleAd(
              adAccountId,
              campaignId,
              adset.id,
              actId,
              metaAdset.id,
              ad,
              targeting,
              campaignStatus,
              videoUrlMap,
            ),
          ),
        );

        for (const result of adResults) {
          if (result.status === 'fulfilled' && result.value) adsPushed++;
        }
      } catch (err) {
        this.logger.error(
          `Failed to create adset "${adset.name}" (${adset.id}) on Meta: ${(err as Error).message}`,
        );
        // Continue with remaining adsets
      }
    }

    this.logger.log(
      `Campaign launched (background): ` +
        `meta_campaign=${metaCampaignId}, ` +
        `adsets_pushed=${adsetsPushed}/${adsets.length}, ` +
        `ads_pushed=${adsPushed}`,
    );
  }

  /**
   * Push a single ad (creative + ad) to Meta.
   * Video uploads are deduplicated in pushAdsetsAndAds() and passed via videoUrlMap.
   * Returns true if successful, false otherwise.
   */
  private async pushSingleAd(
    adAccountId: string,
    campaignId: string,
    adsetId: string,
    actId: string,
    metaAdsetId: string,
    ad: {
      id: string;
      name: string;
      adPosts: Array<{
        id: string;
        postSource: string;
        externalPostId: string | null;
        creativeConfig: unknown;
        page: { externalId: string } | null;
        assetMedia: { url: string; mediaType: string } | null;
        assetThumbnail: { url: string } | null;
        assetAdtext: { primaryText: string | null; headline: string | null; description: string | null } | null;
      }>;
    },
    targeting: Record<string, unknown>,
    campaignStatus: string,
    videoUrlMap: Map<string, string>,
  ): Promise<boolean> {
    try {
      const adPost = ad.adPosts?.[0];

      if (!adPost?.page?.externalId) {
        this.logger.warn(
          `Ad "${ad.name}" (${ad.id}) has no page connection — skipping Meta push`,
        );
        await this.prisma.ad.update({
          where: { id: ad.id },
          data: { status: campaignStatus as any },
        });
        return false;
      }

      const pageExternalId = adPost.page.externalId;
      const baseDestUrl =
        (targeting.destinationUrl as string) || '';

      // Build per-ad destination URL with full UTM tracking
      const utmParams = new URLSearchParams({
        utm_source: 'facebook',
        utm_medium: 'paid',
        utm_campaign: campaignId,
        utm_term: adsetId,
        utm_content: ad.id,
      });
      const separator = baseDestUrl.includes('?') ? '&' : '?';
      const destinationUrl = baseDestUrl
        ? `${baseDestUrl}${separator}${utmParams.toString()}`
        : '';

      // ── Resolve creative data ──
      const cc = (adPost.creativeConfig ?? {}) as Record<string, unknown>;

      // Text fields: prefer creativeConfig, fallback to old assetAdtext
      const primaryText =
        (cc.primaryText as string) ||
        adPost.assetAdtext?.primaryText ||
        '';
      const headline =
        (cc.headline as string) ||
        adPost.assetAdtext?.headline ||
        '';
      const description =
        (cc.description as string) ||
        adPost.assetAdtext?.description ||
        '';

      // Media: prefer creativeConfig, fallback to old assetMedia
      const videoUrl = (cc.videoUrl as string) || null;
      const thumbnailUrl =
        (cc.thumbnailUrl as string) ||
        adPost.assetThumbnail?.url ||
        null;
      const isVideoAd =
        cc.adFormat === 'VIDEO_AD' ||
        (videoUrl !== null) ||
        adPost.assetMedia?.mediaType === 'VIDEO';
      const imageUrl =
        adPost.assetMedia?.mediaType === 'IMAGE'
          ? adPost.assetMedia.url
          : null;

      // Build ad creative
      const creativePayload: Record<string, unknown> = {
        name: `Creative - ${ad.name}`,
      };

      if (
        adPost.postSource === 'EXISTING' &&
        adPost.externalPostId
      ) {
        creativePayload.object_story_id = `${pageExternalId}_${adPost.externalPostId}`;
      } else if (isVideoAd && (videoUrl || adPost.assetMedia?.url)) {
        const videoSrc = videoUrl || adPost.assetMedia?.url;

        // BUG-025: lookup pre-uploaded video from dedup map instead of uploading per-ad
        const metaVideoId = videoSrc ? videoUrlMap.get(videoSrc) : undefined;
        if (!metaVideoId) {
          this.logger.warn(
            `Ad "${ad.name}" (${ad.id}) — video not found in dedup map (${videoSrc}), skipping`,
          );
          return false;
        }

        this.logger.log(
          `Using pre-uploaded video for ad "${ad.name}": ${videoSrc} → Meta video ID: ${metaVideoId}`,
        );

        const videoData: Record<string, unknown> = {
          video_id: metaVideoId,
          message: primaryText,
          title: headline,
          link_description: description,
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: destinationUrl },
          },
        };

        if (thumbnailUrl) {
          videoData.image_url = thumbnailUrl;
        }

        creativePayload.object_story_spec = JSON.stringify({
          page_id: pageExternalId,
          video_data: videoData,
        });
      } else {
        const linkData: Record<string, unknown> = {
          link: destinationUrl,
          message: primaryText,
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: destinationUrl },
          },
        };
        if (headline) linkData.name = headline;
        if (description) linkData.description = description;

        if (imageUrl) {
          linkData.picture = imageUrl;
        } else if (thumbnailUrl) {
          linkData.picture = thumbnailUrl;
        }

        creativePayload.object_story_spec = JSON.stringify({
          page_id: pageExternalId,
          link_data: linkData,
        });
      }

      this.logger.log(
        `Creating creative for ad "${ad.name}": ${JSON.stringify(creativePayload)}`,
      );

      const metaCreative = await this.metaService.post<{
        id: string;
      }>(
        adAccountId,
        `${actId}/adcreatives`,
        creativePayload,
      );

      // Create ad on Meta
      const adPayload: Record<string, unknown> = {
        adset_id: metaAdsetId,
        creative: JSON.stringify({
          creative_id: metaCreative.id,
        }),
        name: ad.name,
        status: 'ACTIVE', // Ads always ACTIVE — campaign-level PAUSED controls delivery
      };

      this.logger.log(
        `Creating ad "${ad.name}" on Meta: ${JSON.stringify(adPayload)}`,
      );

      const metaAd = await this.metaService.post<{ id: string }>(
        adAccountId,
        `${actId}/ads`,
        adPayload,
      );

      // Update local ad
      await this.prisma.ad.update({
        where: { id: ad.id },
        data: {
          externalAdId: metaAd.id,
          status: campaignStatus as any,
        },
      });

      this.logger.log(
        `Ad "${ad.name}" → Meta ID: ${metaAd.id}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to create ad "${ad.name}" (${ad.id}) on Meta: ${(err as Error).message}`,
      );
      return false;
    }
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
