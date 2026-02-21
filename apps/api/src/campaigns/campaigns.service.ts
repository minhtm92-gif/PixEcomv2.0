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
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';

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

// ─── Select shape ─────────────────────────────────────────────────────────────

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
        sellpage: { select: { id: true, slug: true } },
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
        sellpage: r.sellpage,
        adAccount: r.adAccount,
        adsetsCount: r._count.adsets,
      })),
      nextCursor,
    };
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  async getCampaign(sellerId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, sellerId },
      select: {
        ...CAMPAIGN_SELECT,
        sellpage: { select: { id: true, slug: true } },
        adAccount: { select: { id: true, name: true, externalId: true } },
        adStrategy: { select: { id: true, name: true } },
        _count: { select: { adsets: true } },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return {
      ...mapCampaign(campaign),
      sellpage: campaign.sellpage,
      adAccount: campaign.adAccount,
      adStrategy: campaign.adStrategy ?? null,
      adsetsCount: campaign._count.adsets,
    };
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
      select: CAMPAIGN_SELECT,
    });

    return mapCampaign(updated);
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
    const metaPayload = {
      name: campaign.name,
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE',
      special_ad_categories: [] as string[],
    };

    this.logger.log(`Launching campaign "${campaign.name}" → Meta path: ${metaPath}`);

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
      select: CAMPAIGN_SELECT,
    });

    this.logger.log(`Campaign ${campaignId} launched. Meta ID: ${metaResponse.id}`);

    return mapCampaign(updated);
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
      select: CAMPAIGN_SELECT,
    });

    return mapCampaign(updated);
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
      select: CAMPAIGN_SELECT,
    });

    return mapCampaign(updated);
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

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
  sellpageId: string;
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
  return {
    id: c.id,
    sellerId: c.sellerId,
    sellpageId: c.sellpageId,
    adAccountId: c.adAccountId,
    adStrategyId: c.adStrategyId ?? null,
    externalCampaignId: c.externalCampaignId ?? null,
    name: c.name,
    budget: Number(c.budget),
    budgetType: c.budgetType,
    status: c.status,
    deliveryStatus: c.deliveryStatus ?? null,
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
