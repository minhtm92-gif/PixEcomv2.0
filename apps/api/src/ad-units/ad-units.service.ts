import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdsetDto } from './dto/create-adset.dto';
import { UpdateAdsetDto } from './dto/update-adset.dto';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { CreateAdPostDto } from './dto/create-ad-post.dto';

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

const AD_POST_SELECT = {
  id: true,
  sellerId: true,
  adId: true,
  pageId: true,
  externalPostId: true,
  postSource: true,
  assetMediaId: true,
  assetThumbnailId: true,
  assetAdtextId: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── AdUnitsService ───────────────────────────────────────────────────────────

@Injectable()
export class AdUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // ADSETS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /campaigns/:campaignId/adsets
   * Cascade validation: campaign must belong to seller + status != DELETED
   */
  async createAdset(
    sellerId: string,
    campaignId: string,
    dto: CreateAdsetDto,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, sellerId },
      select: { id: true, status: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    if (campaign.status === 'DELETED') {
      throw new BadRequestException(
        `Cannot add adsets to a DELETED campaign`,
      );
    }

    const adset = await this.prisma.adset.create({
      data: {
        campaignId,
        sellerId,
        name: dto.name,
        status: 'PAUSED' as any,
        optimizationGoal: dto.optimizationGoal ?? null,
        targeting: (dto.targeting ?? {}) as any,
      },
      select: ADSET_SELECT,
    });

    return mapAdset(adset);
  }

  /**
   * GET /campaigns/:campaignId/adsets
   */
  async listAdsets(
    sellerId: string,
    campaignId: string,
    cursor?: string,
    limit?: number,
  ) {
    // Verify campaign belongs to seller
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, sellerId },
      select: { id: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursorData = cursor ? decodeCursor(cursor) : null;

    const andClauses: Record<string, unknown>[] = [
      { campaignId },
      { sellerId },
    ];
    if (cursorData) {
      andClauses.push({
        OR: [
          { createdAt: { lt: cursorData.createdAt } },
          { createdAt: { equals: cursorData.createdAt }, id: { lt: cursorData.id } },
        ],
      });
    }

    const rows = await this.prisma.adset.findMany({
      where: { AND: andClauses },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      select: {
        ...ADSET_SELECT,
        _count: { select: { ads: true } },
      },
    });

    const hasMore = rows.length > take;
    if (hasMore) rows.pop();

    const nextCursor =
      hasMore && rows.length > 0
        ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id)
        : null;

    return {
      items: rows.map((r) => ({
        ...mapAdset(r),
        adsCount: r._count.ads,
      })),
      nextCursor,
    };
  }

  /**
   * GET /adsets/:id
   */
  async getAdset(sellerId: string, adsetId: string) {
    const adset = await this.prisma.adset.findFirst({
      where: { id: adsetId, sellerId },
      select: {
        ...ADSET_SELECT,
        campaign: { select: { id: true, name: true, status: true } },
        _count: { select: { ads: true } },
      },
    });
    if (!adset) {
      throw new NotFoundException(`Adset ${adsetId} not found`);
    }
    return {
      ...mapAdset(adset),
      campaign: adset.campaign,
      adsCount: adset._count.ads,
    };
  }

  /**
   * PATCH /adsets/:id
   */
  async updateAdset(sellerId: string, adsetId: string, dto: UpdateAdsetDto) {
    await this.assertAdsetBelongsToSeller(sellerId, adsetId);

    const hasFields =
      dto.name !== undefined ||
      dto.optimizationGoal !== undefined ||
      dto.targeting !== undefined ||
      dto.status !== undefined;

    if (!hasFields) {
      throw new BadRequestException('At least one field must be provided');
    }

    const updated = await this.prisma.adset.update({
      where: { id: adsetId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.optimizationGoal !== undefined && { optimizationGoal: dto.optimizationGoal }),
        ...(dto.targeting !== undefined && { targeting: dto.targeting as any }),
        ...(dto.status !== undefined && { status: dto.status as any }),
      },
      select: ADSET_SELECT,
    });

    return mapAdset(updated);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /adsets/:adsetId/ads
   * Cascade validation: adset must belong to seller, campaign not DELETED
   */
  async createAd(sellerId: string, adsetId: string, dto: CreateAdDto) {
    const adset = await this.prisma.adset.findFirst({
      where: { id: adsetId, sellerId },
      select: {
        id: true,
        campaign: { select: { id: true, status: true } },
      },
    });
    if (!adset) {
      throw new NotFoundException(`Adset ${adsetId} not found`);
    }
    if (adset.campaign.status === 'DELETED') {
      throw new BadRequestException(
        `Cannot add ads to an adset whose campaign is DELETED`,
      );
    }

    const ad = await this.prisma.ad.create({
      data: {
        adsetId,
        sellerId,
        name: dto.name,
        status: 'PAUSED' as any,
      },
      select: AD_SELECT,
    });

    return mapAd(ad);
  }

  /**
   * GET /adsets/:adsetId/ads
   */
  async listAds(
    sellerId: string,
    adsetId: string,
    cursor?: string,
    limit?: number,
  ) {
    // Verify adset belongs to seller
    const adset = await this.prisma.adset.findFirst({
      where: { id: adsetId, sellerId },
      select: { id: true },
    });
    if (!adset) {
      throw new NotFoundException(`Adset ${adsetId} not found`);
    }

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursorData = cursor ? decodeCursor(cursor) : null;

    const andClauses: Record<string, unknown>[] = [
      { adsetId },
      { sellerId },
    ];
    if (cursorData) {
      andClauses.push({
        OR: [
          { createdAt: { lt: cursorData.createdAt } },
          { createdAt: { equals: cursorData.createdAt }, id: { lt: cursorData.id } },
        ],
      });
    }

    const rows = await this.prisma.ad.findMany({
      where: { AND: andClauses },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
      select: {
        ...AD_SELECT,
        _count: { select: { adPosts: true } },
      },
    });

    const hasMore = rows.length > take;
    if (hasMore) rows.pop();

    const nextCursor =
      hasMore && rows.length > 0
        ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id)
        : null;

    return {
      items: rows.map((r) => ({
        ...mapAd(r),
        adPostsCount: r._count.adPosts,
      })),
      nextCursor,
    };
  }

  /**
   * GET /ads/:id — includes adPosts
   */
  async getAd(sellerId: string, adId: string) {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, sellerId },
      select: {
        ...AD_SELECT,
        adset: {
          select: {
            id: true,
            name: true,
            campaignId: true,
          },
        },
        adPosts: {
          select: AD_POST_SELECT,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!ad) {
      throw new NotFoundException(`Ad ${adId} not found`);
    }
    return {
      ...mapAd(ad),
      adset: ad.adset,
      adPosts: ad.adPosts.map(mapAdPost),
    };
  }

  /**
   * PATCH /ads/:id
   */
  async updateAd(sellerId: string, adId: string, dto: UpdateAdDto) {
    await this.assertAdBelongsToSeller(sellerId, adId);

    const hasFields = dto.name !== undefined || dto.status !== undefined;
    if (!hasFields) {
      throw new BadRequestException('At least one field must be provided');
    }

    const updated = await this.prisma.ad.update({
      where: { id: adId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.status !== undefined && { status: dto.status as any }),
      },
      select: AD_SELECT,
    });

    return mapAd(updated);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AD POSTS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /ads/:adId/ad-post
   * Validates: ad belongs to seller, pageId is FbConnection type=PAGE + seller,
   * asset IDs if provided.
   */
  async createAdPost(sellerId: string, adId: string, dto: CreateAdPostDto) {
    // Validate ad belongs to seller
    await this.assertAdBelongsToSeller(sellerId, adId);

    // Validate pageId: must be FbConnection type=PAGE belonging to seller
    const page = await this.prisma.fbConnection.findFirst({
      where: {
        id: dto.pageId,
        sellerId,
        connectionType: 'PAGE',
        isActive: true,
      },
      select: { id: true },
    });
    if (!page) {
      throw new BadRequestException(
        `pageId ${dto.pageId} is not a valid active PAGE connection for this seller`,
      );
    }

    // Validate assetMediaId if provided
    if (dto.assetMediaId) {
      const media = await this.prisma.assetMedia.findUnique({
        where: { id: dto.assetMediaId },
        select: { id: true },
      });
      if (!media) {
        throw new NotFoundException(`AssetMedia ${dto.assetMediaId} not found`);
      }
    }

    // Validate assetThumbnailId if provided
    if (dto.assetThumbnailId) {
      const thumb = await this.prisma.assetThumbnail.findUnique({
        where: { id: dto.assetThumbnailId },
        select: { id: true },
      });
      if (!thumb) {
        throw new NotFoundException(`AssetThumbnail ${dto.assetThumbnailId} not found`);
      }
    }

    // Validate assetAdtextId if provided
    if (dto.assetAdtextId) {
      const adtext = await this.prisma.assetAdtext.findUnique({
        where: { id: dto.assetAdtextId },
        select: { id: true },
      });
      if (!adtext) {
        throw new NotFoundException(`AssetAdtext ${dto.assetAdtextId} not found`);
      }
    }

    const adPost = await this.prisma.adPost.create({
      data: {
        sellerId,
        adId,
        pageId: dto.pageId,
        postSource: dto.postSource as any,
        externalPostId: dto.externalPostId ?? null,
        assetMediaId: dto.assetMediaId ?? null,
        assetThumbnailId: dto.assetThumbnailId ?? null,
        assetAdtextId: dto.assetAdtextId ?? null,
      },
      select: AD_POST_SELECT,
    });

    return mapAdPost(adPost);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertAdsetBelongsToSeller(sellerId: string, adsetId: string) {
    const adset = await this.prisma.adset.findFirst({
      where: { id: adsetId, sellerId },
      select: { id: true },
    });
    if (!adset) {
      throw new NotFoundException(`Adset ${adsetId} not found`);
    }
    return adset;
  }

  private async assertAdBelongsToSeller(sellerId: string, adId: string) {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, sellerId },
      select: { id: true },
    });
    if (!ad) {
      throw new NotFoundException(`Ad ${adId} not found`);
    }
    return ad;
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapAdset(r: {
  id: string;
  campaignId: string;
  sellerId: string;
  externalAdsetId: string | null;
  name: string;
  status: any;
  deliveryStatus: string | null;
  optimizationGoal: string | null;
  targeting: any;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    campaignId: r.campaignId,
    sellerId: r.sellerId,
    externalAdsetId: r.externalAdsetId ?? null,
    name: r.name,
    status: r.status,
    deliveryStatus: r.deliveryStatus ?? null,
    optimizationGoal: r.optimizationGoal ?? null,
    targeting: (r.targeting as Record<string, unknown>) ?? {},
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapAd(r: {
  id: string;
  adsetId: string;
  sellerId: string;
  externalAdId: string | null;
  name: string;
  status: any;
  deliveryStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    adsetId: r.adsetId,
    sellerId: r.sellerId,
    externalAdId: r.externalAdId ?? null,
    name: r.name,
    status: r.status,
    deliveryStatus: r.deliveryStatus ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapAdPost(r: {
  id: string;
  sellerId: string;
  adId: string | null;
  pageId: string;
  externalPostId: string | null;
  postSource: any;
  assetMediaId: string | null;
  assetThumbnailId: string | null;
  assetAdtextId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    sellerId: r.sellerId,
    adId: r.adId ?? null,
    pageId: r.pageId,
    externalPostId: r.externalPostId ?? null,
    postSource: r.postSource,
    assetMediaId: r.assetMediaId ?? null,
    assetThumbnailId: r.assetThumbnailId ?? null,
    assetAdtextId: r.assetAdtextId ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
