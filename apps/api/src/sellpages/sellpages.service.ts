import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSellpageDto } from './dto/create-sellpage.dto';
import { ListSellpagesDto } from './dto/list-sellpages.dto';
import { UpdateSellpageDto } from './dto/update-sellpage.dto';

/** Maximum rows per page regardless of caller-supplied limit. */
const MAX_PAGE_LIMIT = 100;

/**
 * Stats stub returned until the stats worker is wired up (Phase 2).
 * Shape mirrors the eventual real shape so the frontend contract is stable.
 */
const STUB_STATS = {
  revenue: 0,
  cost: 0,
  youTake: 0,
  hold: 0,
  cashToBalance: 0,
};

// ─── Shared row shapes ───────────────────────────────────────────────────────

type SellpageCardRow = {
  id: string;
  sellerId: string;
  productId: string;
  domainId: string | null;
  slug: string;
  status: string;
  sellpageType: string;
  titleOverride: string | null;
  descriptionOverride: string | null;
  createdAt: Date;
  updatedAt: Date;
  domain: { id: string; hostname: string } | null;
};

type SellpageDetailRow = SellpageCardRow & {
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: { toString(): string };
    assetThumbs: Array<{ url: string }>;
  };
};

// ─── Prisma select objects ────────────────────────────────────────────────────

const SELLPAGE_CARD_SELECT = {
  id: true,
  sellerId: true,
  productId: true,
  domainId: true,
  slug: true,
  status: true,
  sellpageType: true,
  titleOverride: true,
  descriptionOverride: true,
  createdAt: true,
  updatedAt: true,
  domain: {
    select: { id: true, hostname: true },
  },
} as const;

// Note: SELLPAGE_DETAIL_SELECT cannot use `as const` because Prisma's
// AssetThumbnailOrderByWithRelationInput[] must be mutable.
// We spread the card select fields individually to keep typing clean.
const SELLPAGE_DETAIL_SELECT = {
  id: true,
  sellerId: true,
  productId: true,
  domainId: true,
  slug: true,
  status: true,
  sellpageType: true,
  titleOverride: true,
  descriptionOverride: true,
  createdAt: true,
  updatedAt: true,
  domain: {
    select: { id: true, hostname: true },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      assetThumbs: {
        orderBy: [
          { isCurrent: 'desc' as const },
          { position: 'asc' as const },
        ] as { isCurrent?: 'desc' | 'asc'; position?: 'desc' | 'asc' }[],
        take: 1,
        select: { url: true },
      },
    },
  },
};

@Injectable()
export class SellpagesService {
  private readonly logger = new Logger(SellpagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new sellpage for the given seller.
   *
   * Validates:
   *  - productId must reference an existing product
   *  - domainId (if provided) must belong to this seller
   *  - slug must be unique within this seller's sellpages (DB unique constraint covers this)
   *
   * Throws:
   *  - 404 if product not found
   *  - 403 if domainId belongs to another seller
   *  - 409 if slug already used by this seller
   */
  async createSellpage(sellerId: string, dto: CreateSellpageDto) {
    // 1. Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, name: true, status: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 2. Validate domainId belongs to this seller (if provided)
    if (dto.domainId) {
      await this.assertDomainBelongsToSeller(sellerId, dto.domainId);
    }

    // 3. Check slug uniqueness (friendly error before DB constraint fires)
    const existing = await this.prisma.sellpage.findUnique({
      where: { uq_sellpage_slug: { sellerId, slug: dto.slug } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Slug "${dto.slug}" is already used by another sellpage`,
      );
    }

    // 4. Create
    const sellpage = await this.prisma.sellpage.create({
      data: {
        sellerId,
        productId: dto.productId,
        slug: dto.slug,
        ...(dto.domainId !== undefined && { domainId: dto.domainId }),
        ...(dto.titleOverride !== undefined && {
          titleOverride: dto.titleOverride,
        }),
        ...(dto.descriptionOverride !== undefined && {
          descriptionOverride: dto.descriptionOverride,
        }),
      },
      select: SELLPAGE_CARD_SELECT,
    });

    return mapToCardDto(sellpage);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of sellpages for the given seller.
   *
   * Filters:
   *  - status → DRAFT | PUBLISHED | ARCHIVED
   *  - q      → case-insensitive contains match on titleOverride OR slug
   */
  async listSellpages(
    sellerId: string,
    dto: ListSellpagesDto,
  ): Promise<{
    data: ReturnType<typeof mapToCardDto>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, MAX_PAGE_LIMIT);
    const skip = (page - 1) * limit;

    const where = buildListWhere(sellerId, dto);

    const [sellpages, total] = await this.prisma.$transaction([
      this.prisma.sellpage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: SELLPAGE_CARD_SELECT,
      }),
      this.prisma.sellpage.count({ where }),
    ]);

    return {
      data: sellpages.map((s) => mapToCardDto(s as SellpageCardRow)),
      total,
      page,
      limit,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns full sellpage detail with product snapshot and URL preview.
   * Throws 404 if not found or belongs to another seller.
   */
  async getSellpage(sellerId: string, id: string) {
    const sellpage = await this.prisma.sellpage.findUnique({
      where: { id },
      select: SELLPAGE_DETAIL_SELECT,
    });

    if (!sellpage || sellpage.sellerId !== sellerId) {
      throw new NotFoundException('Sellpage not found');
    }

    return mapToDetailDto(sellpage as unknown as SellpageDetailRow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Partial update of a sellpage.
   * At least one field must be provided.
   * Validates domainId ownership if provided.
   * Validates slug uniqueness if slug is being changed.
   */
  async updateSellpage(
    sellerId: string,
    id: string,
    dto: UpdateSellpageDto,
  ) {
    // Check at least one field
    const hasFields =
      dto.slug !== undefined ||
      dto.domainId !== undefined ||
      dto.titleOverride !== undefined ||
      dto.descriptionOverride !== undefined ||
      dto.customDomain !== undefined ||
      dto.pixelId !== undefined;

    if (!hasFields) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // Assert sellpage exists and belongs to seller
    await this.assertSellpageBelongsToSeller(sellerId, id);

    // Validate domainId ownership
    if (dto.domainId !== undefined && dto.domainId !== null) {
      await this.assertDomainBelongsToSeller(sellerId, dto.domainId);
    }

    // Validate slug uniqueness if changing
    if (dto.slug !== undefined) {
      const existing = await this.prisma.sellpage.findUnique({
        where: { uq_sellpage_slug: { sellerId, slug: dto.slug } },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Slug "${dto.slug}" is already used by another sellpage`,
        );
      }
    }

    // B.2: Validate pixelId if provided
    let resolvedPixelId: string | null | undefined = undefined;
    if (dto.pixelId !== undefined) {
      if (dto.pixelId === null) {
        resolvedPixelId = null;
      } else {
        const pixel = await this.prisma.fbConnection.findFirst({
          where: { id: dto.pixelId, sellerId, connectionType: 'PIXEL', isActive: true },
          select: { id: true },
        });
        if (!pixel) {
          throw new BadRequestException(
            `FbConnection ${dto.pixelId} is not an active PIXEL connection for this seller`,
          );
        }
        resolvedPixelId = dto.pixelId;
      }
    }

    // Build headerConfig update if pixelId changed
    let headerConfigUpdate: Record<string, unknown> | undefined;
    if (resolvedPixelId !== undefined) {
      // Load current headerConfig
      const current = await this.prisma.sellpage.findUnique({
        where: { id },
        select: { headerConfig: true },
      });
      const existing = (current?.headerConfig as Record<string, unknown>) ?? {};
      headerConfigUpdate = resolvedPixelId === null
        ? { ...existing, pixelId: null }
        : { ...existing, pixelId: resolvedPixelId };
    }

    const updated = await this.prisma.sellpage.update({
      where: { id },
      data: {
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.domainId !== undefined && { domainId: dto.domainId }),
        ...(dto.titleOverride !== undefined && {
          titleOverride: dto.titleOverride,
        }),
        ...(dto.descriptionOverride !== undefined && {
          descriptionOverride: dto.descriptionOverride,
        }),
        ...(dto.customDomain !== undefined && { customDomain: dto.customDomain }),
        ...(headerConfigUpdate !== undefined && { headerConfig: headerConfigUpdate }),
      } as any,
      select: SELLPAGE_CARD_SELECT,
    });

    return mapToCardDto(updated as unknown as SellpageCardRow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLISH / UNPUBLISH
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transitions a sellpage from DRAFT → PUBLISHED.
   *
   * Throws 400 if:
   *   - already PUBLISHED or ARCHIVED
   *   - a domainId is set but that domain is not VERIFIED
   *     (Sellers must verify ownership before a domain goes live)
   */
  async publishSellpage(sellerId: string, id: string) {
    const sellpage = await this.assertSellpageBelongsToSeller(sellerId, id);

    if (sellpage.status === 'PUBLISHED') {
      throw new BadRequestException('Sellpage is already published');
    }
    if (sellpage.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot publish an archived sellpage');
    }

    // Domain verification gate: if a domain is linked it must be VERIFIED
    if (sellpage.domainId) {
      const domain = await this.prisma.sellerDomain.findUnique({
        where: { id: sellpage.domainId },
        select: { status: true, hostname: true },
      });
      if (!domain || domain.status !== 'VERIFIED') {
        throw new BadRequestException(
          `The linked domain "${domain?.hostname ?? sellpage.domainId}" ` +
            'must be VERIFIED before publishing. ' +
            'Use POST /api/domains/:id/verify to verify it first.',
        );
      }
    }

    const updated = await this.prisma.sellpage.update({
      where: { id },
      data: { status: 'PUBLISHED' },
      select: SELLPAGE_CARD_SELECT,
    });

    return mapToCardDto(updated as SellpageCardRow);
  }

  /**
   * Transitions a sellpage from PUBLISHED → DRAFT.
   * Throws 400 if not currently PUBLISHED.
   */
  async unpublishSellpage(sellerId: string, id: string) {
    const sellpage = await this.assertSellpageBelongsToSeller(sellerId, id);

    if (sellpage.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Only published sellpages can be unpublished',
      );
    }

    const updated = await this.prisma.sellpage.update({
      where: { id },
      data: { status: 'DRAFT' },
      select: SELLPAGE_CARD_SELECT,
    });

    return mapToCardDto(updated as SellpageCardRow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMAIN CHECK / VERIFY  (B.1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/sellpages/check-domain?domain=xxx
   * Check if a customDomain value is already in use by another sellpage.
   */
  async checkDomainAvailability(domain: string): Promise<{ available: boolean }> {
    const existing = await this.prisma.sellpage.findFirst({
      where: { customDomain: domain },
      select: { id: true },
    });
    return { available: !existing };
  }

  /**
   * POST /api/sellpages/:id/verify-domain
   * Mock DNS verification (always succeeds in alpha).
   */
  async verifyDomain(sellerId: string, id: string) {
    const sellpage = await this.assertSellpageBelongsToSeller(sellerId, id);
    const domain = await this.prisma.sellpage.findUnique({
      where: { id },
      select: { customDomain: true },
    });
    const cname = `cname.pixecom.io`;
    return {
      verified: true,
      domain: domain?.customDomain ?? null,
      expectedCname: cname,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PIXEL  (B.2)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/sellpages/:id/pixel
   * Return the pixel assigned to this sellpage via headerConfig.pixelId.
   */
  async getPixel(sellerId: string, id: string) {
    const sellpage = await this.prisma.sellpage.findUnique({
      where: { id },
      select: { sellerId: true, headerConfig: true },
    });
    if (!sellpage || sellpage.sellerId !== sellerId) {
      throw new NotFoundException('Sellpage not found');
    }

    const header = (sellpage.headerConfig as Record<string, unknown>) ?? {};
    const pixelId = typeof header['pixelId'] === 'string' ? header['pixelId'] : null;

    if (!pixelId) {
      return { pixelId: null, pixelName: null, pixelExternalId: null };
    }

    const pixel = await this.prisma.fbConnection.findFirst({
      where: { id: pixelId, sellerId, connectionType: 'PIXEL' },
      select: { id: true, name: true, externalId: true },
    });

    if (!pixel) {
      return { pixelId, pixelName: null, pixelExternalId: null };
    }

    return {
      pixelId: pixel.id,
      pixelName: pixel.name ?? null,
      pixelExternalId: pixel.externalId,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LINKED ADS  (B.3 — enhanced with metrics + asset details)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns the full Campaign → Adset → Ad → AdPost chain for a sellpage.
   * Enhanced (B.3): includes thumbnailUrl, adText, and last-7-day metrics.
   *
   * Single Prisma query + 1 batch stats query — no N+1.
   * Throws 404 if the sellpage does not exist or belongs to another seller.
   */
  async getLinkedAds(sellerId: string, sellpageId: string) {
    // Verify sellpage ownership first (404 on miss or wrong seller)
    const sellpage = await this.prisma.sellpage.findUnique({
      where: { id: sellpageId },
      select: { id: true, sellerId: true },
    });
    if (!sellpage || sellpage.sellerId !== sellerId) {
      throw new NotFoundException('Sellpage not found');
    }

    // Single query: Campaign → Adset → Ad → AdPost (with asset + page details)
    const campaigns = await this.prisma.campaign.findMany({
      where: { sellpageId, sellerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        adsets: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            status: true,
            ads: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                name: true,
                status: true,
                adPosts: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  select: {
                    externalPostId: true,
                    pageId: true,
                    createdAt: true,
                    page: { select: { name: true } },
                    assetThumbnail: { select: { url: true } },
                    assetAdtext: { select: { primaryText: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Collect all ad IDs for batch stats query
    const allAdIds: string[] = [];
    for (const camp of campaigns) {
      for (const adset of camp.adsets) {
        for (const ad of adset.ads) {
          allAdIds.push(ad.id);
        }
      }
    }

    // Batch stats query: sum last 7 days for all ad IDs (no N+1)
    const statsMap = new Map<string, {
      spend: number;
      impressions: number;
      clicks: number;
      purchases: number;
      roas: number;
    }>();

    if (allAdIds.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const statsRows = await this.prisma.adStatsDaily.findMany({
        where: {
          sellerId,
          entityType: 'AD',
          entityId: { in: allAdIds },
          statDate: { gte: sevenDaysAgo },
        },
        select: {
          entityId: true,
          spend: true,
          impressions: true,
          linkClicks: true,
          purchases: true,
          purchaseValue: true,
        },
      });

      // Aggregate per adId
      for (const row of statsRows) {
        const existing = statsMap.get(row.entityId) ?? {
          spend: 0, impressions: 0, clicks: 0, purchases: 0,
          _purchaseValue: 0, _spend: 0,
        } as any;
        existing.spend += Number(row.spend);
        existing.impressions += row.impressions;
        existing.clicks += row.linkClicks;
        existing.purchases += row.purchases;
        existing._purchaseValue = (existing._purchaseValue ?? 0) + Number(row.purchaseValue);
        existing._spend = existing.spend;
        statsMap.set(row.entityId, existing);
      }

      // Compute ROAS: purchaseValue / spend
      for (const [adId, stats] of statsMap.entries()) {
        const raw = stats as any;
        const roas = raw._spend > 0 ? raw._purchaseValue / raw._spend : 0;
        statsMap.set(adId, {
          spend: raw.spend,
          impressions: raw.impressions,
          clicks: raw.clicks,
          purchases: raw.purchases,
          roas: Math.round(roas * 100) / 100,
        });
      }
    }

    return {
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        adsets: campaign.adsets.map((adset) => ({
          id: adset.id,
          name: adset.name,
          status: adset.status,
          ads: adset.ads.map((ad) => {
            const post = ad.adPosts[0] ?? null;
            const metrics = statsMap.get(ad.id) ?? null;
            return {
              id: ad.id,
              name: ad.name,
              status: ad.status,
              adPost: post
                ? {
                    externalPostId: post.externalPostId ?? null,
                    pageId: post.pageId,
                    pageName: post.page?.name ?? null,
                    thumbnailUrl: post.assetThumbnail?.url ?? null,
                    adText: post.assetAdtext?.primaryText ?? null,
                    createdAt: post.createdAt.toISOString(),
                  }
                : null,
              metrics,
            };
          }),
        })),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Asserts that a domain exists and belongs to the given seller.
   * Throws 403 ForbiddenException if the domain belongs to another seller,
   * or 404 NotFoundException if it does not exist.
   */
  private async assertDomainBelongsToSeller(
    sellerId: string,
    domainId: string,
  ) {
    const domain = await this.prisma.sellerDomain.findUnique({
      where: { id: domainId },
      select: { id: true, sellerId: true },
    });
    if (!domain) {
      throw new NotFoundException(`Domain ${domainId} not found`);
    }
    if (domain.sellerId !== sellerId) {
      throw new ForbiddenException('Domain does not belong to this seller');
    }
    return domain;
  }

  /**
   * Asserts that a sellpage exists and belongs to the given seller.
   * Throws 404 if not found or belongs to another seller.
   */
  private async assertSellpageBelongsToSeller(
    sellerId: string,
    id: string,
  ) {
    const sellpage = await this.prisma.sellpage.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, domainId: true },
    });
    if (!sellpage || sellpage.sellerId !== sellerId) {
      throw new NotFoundException('Sellpage not found');
    }
    return sellpage;
  }
}

// ─── Module-level pure mapping functions ─────────────────────────────────────
// Kept outside the class to avoid `this` scoping issues in generic return types.

/**
 * Derives the URL preview for a sellpage.
 * - If a domain is linked → https://{hostname}/{slug}
 * - Otherwise            → <unassigned-domain>/{slug}
 */
function buildUrlPreview(
  slug: string,
  domain: { hostname: string } | null,
): string {
  if (domain) {
    return `https://${domain.hostname}/${slug}`;
  }
  return `<unassigned-domain>/${slug}`;
}

/**
 * Maps a Prisma sellpage card row to a list/create/update response DTO.
 */
function mapToCardDto(sellpage: SellpageCardRow) {
  return {
    id: sellpage.id,
    sellerId: sellpage.sellerId,
    productId: sellpage.productId,
    domainId: sellpage.domainId,
    slug: sellpage.slug,
    status: sellpage.status,
    sellpageType: sellpage.sellpageType,
    titleOverride: sellpage.titleOverride,
    descriptionOverride: sellpage.descriptionOverride,
    urlPreview: buildUrlPreview(sellpage.slug, sellpage.domain),
    stats: { ...STUB_STATS },
    createdAt: sellpage.createdAt.toISOString(),
    updatedAt: sellpage.updatedAt.toISOString(),
  };
}

/**
 * Maps a detailed sellpage row (with product snapshot) to a response DTO.
 */
function mapToDetailDto(sellpage: SellpageDetailRow) {
  const card = mapToCardDto(sellpage);

  return {
    ...card,
    product: {
      id: sellpage.product.id,
      name: sellpage.product.name,
      slug: sellpage.product.slug,
      basePrice: sellpage.product.basePrice.toString(),
      heroImageUrl:
        sellpage.product.assetThumbs.length > 0
          ? sellpage.product.assetThumbs[0].url
          : null,
    },
  };
}

/**
 * Builds the Prisma WHERE clause for listSellpages.
 */
function buildListWhere(sellerId: string, dto: ListSellpagesDto) {
  const conditions: Record<string, unknown>[] = [{ sellerId }];

  if (dto.status) {
    conditions.push({ status: dto.status });
  }

  if (dto.q) {
    const term = dto.q.trim();
    conditions.push({
      OR: [
        { slug: { contains: term, mode: 'insensitive' } },
        { titleOverride: { contains: term, mode: 'insensitive' } },
      ],
    });
  }

  return { AND: conditions };
}
