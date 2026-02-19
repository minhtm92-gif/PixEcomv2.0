import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

// ─── Select shapes ────────────────────────────────────────────────────────────

const CAMPAIGN_LIST_SELECT = {
  id: true,
  sellerId: true,
  sellpageId: true,
  adAccountId: true,
  adStrategyId: true,
  name: true,
  budget: true,
  budgetType: true,
  status: true,
  deliveryStatus: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      adsets: true,
    },
  },
  creatives: {
    select: {
      creativeId: true,
    },
  },
} as const;

const CAMPAIGN_DETAIL_SELECT = {
  id: true,
  sellerId: true,
  sellpageId: true,
  adAccountId: true,
  adStrategyId: true,
  name: true,
  budget: true,
  budgetType: true,
  status: true,
  deliveryStatus: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  creatives: {
    select: {
      id: true,
      creativeId: true,
      createdAt: true,
    },
  },
  adsets: {
    select: {
      id: true,
      name: true,
      status: true,
      optimizationGoal: true,
      createdAt: true,
      ads: {
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          adPosts: {
            select: {
              id: true,
              pageId: true,
              postSource: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────

  async createCampaign(sellerId: string, dto: CreateCampaignDto) {
    // Validate all references up-front
    const { resolvedBudget, resolvedBudgetType } =
      await this.validateAndResolve(sellerId, dto);

    // Build campaign + adset + ad + adpost in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create campaign
      const campaign = await tx.campaign.create({
        data: {
          sellerId,
          sellpageId: dto.sellpageId,
          adAccountId: dto.adAccountConnectionId,
          adStrategyId: dto.adStrategyId ?? null,
          name: dto.name,
          budget: resolvedBudget,
          budgetType: resolvedBudgetType as any,
          status: 'ACTIVE',
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
        select: { id: true },
      });

      // 2. Attach creatives (campaign_creatives join)
      if (dto.creativeIds && dto.creativeIds.length > 0) {
        await tx.campaignCreative.createMany({
          data: dto.creativeIds.map((creativeId) => ({
            campaignId: campaign.id,
            creativeId,
          })),
          skipDuplicates: true,
        });
      }

      // 3. Create AdSet
      const adsetName = dto.adsetName ?? `${dto.name} — AdSet 1`;
      const adset = await tx.adset.create({
        data: {
          campaignId: campaign.id,
          sellerId,
          name: adsetName,
          status: 'ACTIVE',
          targeting: {},
        },
        select: { id: true },
      });

      // 4. Create Ad
      const adName = dto.adName ?? `${dto.name} — Ad 1`;
      const ad = await tx.ad.create({
        data: {
          adsetId: adset.id,
          sellerId,
          name: adName,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // 5. Create AdPost (links page connection + ad)
      const adPost = await tx.adPost.create({
        data: {
          sellerId,
          adId: ad.id,
          pageId: dto.pageConnectionId,
          postSource: 'CONTENT_SOURCE',
        },
        select: { id: true },
      });

      return {
        campaignId: campaign.id,
        adsetId: adset.id,
        adId: ad.id,
        adPostId: adPost.id,
      };
    });

    // Return the full campaign detail
    return this.getCampaign(sellerId, result.campaignId);
  }

  // ─── PREVIEW (no DB writes) ────────────────────────────────────────────────

  async previewCampaign(sellerId: string, dto: CreateCampaignDto) {
    const { resolvedBudget, resolvedBudgetType, sellpage, adAccount, page, adStrategy } =
      await this.validateAndResolve(sellerId, dto);

    return {
      preview: true,
      campaign: {
        name: dto.name,
        sellpageId: dto.sellpageId,
        sellpageSlug: sellpage.slug,
        adAccountId: dto.adAccountConnectionId,
        adAccountName: adAccount.name,
        adAccountExternalId: adAccount.externalId,
        pageConnectionId: dto.pageConnectionId,
        pageName: page.name,
        pageExternalId: page.externalId,
        adStrategyId: dto.adStrategyId ?? null,
        adStrategyName: adStrategy?.name ?? null,
        budget: resolvedBudget,
        budgetType: resolvedBudgetType,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        status: 'ACTIVE',
      },
      adset: {
        name: dto.adsetName ?? `${dto.name} — AdSet 1`,
      },
      ad: {
        name: dto.adName ?? `${dto.name} — Ad 1`,
      },
      adPost: {
        pageId: dto.pageConnectionId,
        postSource: 'CONTENT_SOURCE',
      },
      creatives: dto.creativeIds ?? [],
    };
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────

  async listCampaigns(sellerId: string, query: ListCampaignsDto) {
    const statusFilter = query.status
      ? { status: query.status as any }
      : query.includeArchived
        ? {}
        : { status: { in: ['ACTIVE', 'PAUSED'] as any[] } };

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        sellerId,
        ...statusFilter,
        ...(query.sellpageId ? { sellpageId: query.sellpageId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: CAMPAIGN_LIST_SELECT,
    });

    return campaigns.map(mapListRow);
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────

  async getCampaign(sellerId: string, id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    if (!campaign || campaign.sellerId !== sellerId) {
      throw new NotFoundException('Campaign not found');
    }

    return mapDetailRow(campaign);
  }

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────

  async updateCampaignStatus(
    sellerId: string,
    id: string,
    dto: UpdateCampaignStatusDto,
  ) {
    const existing = await this.prisma.campaign.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true },
    });

    if (!existing || existing.sellerId !== sellerId) {
      throw new NotFoundException('Campaign not found');
    }

    if (existing.status === 'ARCHIVED' || existing.status === 'DELETED') {
      throw new BadRequestException(
        `Cannot toggle status of a ${existing.status} campaign`,
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: dto.status as any },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return mapDetailRow(updated);
  }

  // ─── VALIDATION ───────────────────────────────────────────────────────────

  private async validateAndResolve(sellerId: string, dto: CreateCampaignDto) {
    // 1. Validate sellpage belongs to seller
    const sellpage = await this.prisma.sellpage.findUnique({
      where: { id: dto.sellpageId },
      select: { id: true, sellerId: true, slug: true },
    });
    if (!sellpage || sellpage.sellerId !== sellerId) {
      throw new NotFoundException('Sellpage not found');
    }

    // 2. Validate AD_ACCOUNT connection
    const adAccount = await this.prisma.fbConnection.findUnique({
      where: { id: dto.adAccountConnectionId },
      select: { id: true, sellerId: true, connectionType: true, isActive: true, name: true, externalId: true },
    });
    if (!adAccount || adAccount.sellerId !== sellerId) {
      throw new NotFoundException('Ad account connection not found');
    }
    if (!adAccount.isActive) {
      throw new BadRequestException('Ad account connection is inactive');
    }
    if (adAccount.connectionType !== 'AD_ACCOUNT') {
      throw new BadRequestException(
        `adAccountConnectionId must reference an AD_ACCOUNT connection, got ${adAccount.connectionType}`,
      );
    }

    // 3. Validate PAGE connection
    const page = await this.prisma.fbConnection.findUnique({
      where: { id: dto.pageConnectionId },
      select: { id: true, sellerId: true, connectionType: true, isActive: true, name: true, externalId: true },
    });
    if (!page || page.sellerId !== sellerId) {
      throw new NotFoundException('Page connection not found');
    }
    if (!page.isActive) {
      throw new BadRequestException('Page connection is inactive');
    }
    if (page.connectionType !== 'PAGE') {
      throw new BadRequestException(
        `pageConnectionId must reference a PAGE connection, got ${page.connectionType}`,
      );
    }

    // 4. Validate optional PIXEL connection
    if (dto.pixelConnectionId) {
      const pixel = await this.prisma.fbConnection.findUnique({
        where: { id: dto.pixelConnectionId },
        select: { id: true, sellerId: true, connectionType: true, isActive: true },
      });
      if (!pixel || pixel.sellerId !== sellerId) {
        throw new NotFoundException('Pixel connection not found');
      }
      if (!pixel.isActive) {
        throw new BadRequestException('Pixel connection is inactive');
      }
      if (pixel.connectionType !== 'PIXEL') {
        throw new BadRequestException(
          `pixelConnectionId must reference a PIXEL connection, got ${pixel.connectionType}`,
        );
      }
    }

    // 5. Validate optional ad strategy + resolve budget
    let adStrategy: { id: string; name: string; config: unknown } | null = null;
    let resolvedBudget: number = dto.budgetAmount ?? 5000; // default 50.00
    let resolvedBudgetType: string = dto.budgetType ?? 'DAILY';

    if (dto.adStrategyId) {
      adStrategy = await this.prisma.adStrategy.findUnique({
        where: { id: dto.adStrategyId },
        select: { id: true, sellerId: true, isActive: true, name: true, config: true },
      }) as any;
      if (!adStrategy || (adStrategy as any).sellerId !== sellerId) {
        throw new NotFoundException('Ad strategy not found');
      }
      if (!(adStrategy as any).isActive) {
        throw new BadRequestException('Ad strategy is inactive');
      }
      // If strategy provided but no explicit budget override, use strategy budget
      if (!dto.budgetAmount) {
        const config = (adStrategy as any).config as any;
        if (config?.budget?.amount) {
          resolvedBudget = config.budget.amount;
          resolvedBudgetType = config.budget.budgetType ?? 'DAILY';
        }
      }
    }

    if (!dto.adStrategyId && !dto.budgetAmount) {
      throw new BadRequestException(
        'Either adStrategyId or budgetAmount must be provided',
      );
    }

    // 6. Validate creatives (must belong to seller and be READY)
    if (dto.creativeIds && dto.creativeIds.length > 0) {
      const creatives = await this.prisma.creative.findMany({
        where: { id: { in: dto.creativeIds } },
        select: { id: true, sellerId: true, status: true },
      });

      const creativeMap = new Map(creatives.map((c) => [c.id, c]));

      for (const creativeId of dto.creativeIds) {
        const creative = creativeMap.get(creativeId);
        if (!creative || creative.sellerId !== sellerId) {
          throw new NotFoundException(`Creative ${creativeId} not found`);
        }
        if (creative.status !== 'READY') {
          throw new BadRequestException(
            `Creative ${creativeId} is not READY (status: ${creative.status})`,
          );
        }
      }
    }

    return { resolvedBudget, resolvedBudgetType, sellpage, adAccount, page, adStrategy };
  }
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

type ListRow = {
  id: string;
  sellerId: string;
  sellpageId: string;
  adAccountId: string;
  adStrategyId: string | null;
  name: string;
  budget: { toString(): string };
  budgetType: string;
  status: string;
  deliveryStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { adsets: number };
  creatives: { creativeId: string }[];
};

function mapListRow(c: ListRow) {
  return {
    id: c.id,
    sellerId: c.sellerId,
    name: c.name,
    sellpageId: c.sellpageId,
    adAccountId: c.adAccountId,
    adStrategyId: c.adStrategyId,
    budget: Number(c.budget.toString()),
    budgetType: c.budgetType,
    status: c.status,
    deliveryStatus: c.deliveryStatus,
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    adSetsCount: c._count.adsets,
    creativeIds: c.creatives.map((cc) => cc.creativeId),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

type DetailRow = {
  id: string;
  sellerId: string;
  sellpageId: string;
  adAccountId: string;
  adStrategyId: string | null;
  name: string;
  budget: { toString(): string };
  budgetType: string;
  status: string;
  deliveryStatus: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creatives: { id: string; creativeId: string; createdAt: Date }[];
  adsets: {
    id: string;
    name: string;
    status: string;
    optimizationGoal: string | null;
    createdAt: Date;
    ads: {
      id: string;
      name: string;
      status: string;
      createdAt: Date;
      adPosts: {
        id: string;
        pageId: string;
        postSource: string;
        createdAt: Date;
      }[];
    }[];
  }[];
};

function mapDetailRow(c: DetailRow) {
  return {
    id: c.id,
    sellerId: c.sellerId,
    name: c.name,
    sellpageId: c.sellpageId,
    adAccountId: c.adAccountId,
    adStrategyId: c.adStrategyId,
    budget: Number(c.budget.toString()),
    budgetType: c.budgetType,
    status: c.status,
    deliveryStatus: c.deliveryStatus,
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    creativeIds: c.creatives.map((cc) => cc.creativeId),
    adsets: c.adsets.map((adset) => ({
      id: adset.id,
      name: adset.name,
      status: adset.status,
      optimizationGoal: adset.optimizationGoal,
      createdAt: adset.createdAt.toISOString(),
      ads: adset.ads.map((ad) => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        createdAt: ad.createdAt.toISOString(),
        adPosts: ad.adPosts.map((ap) => ({
          id: ap.id,
          pageId: ap.pageId,
          postSource: ap.postSource,
          createdAt: ap.createdAt.toISOString(),
        })),
      })),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
