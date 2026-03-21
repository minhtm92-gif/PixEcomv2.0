import { Injectable, NotFoundException } from '@nestjs/common';
import { safeDivide } from '../ads-manager/ads-manager.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductCardDto, ProductLabelDto, ProductStatsDto } from './dto/product-card.dto';
import { ProductDetailDto, ProductVariantDto } from './dto/product-detail.dto';
import { ListProductsDto } from './dto/list-products.dto';

/** Maximum rows per page regardless of caller-supplied limit. */
const MAX_PAGE_LIMIT = 100;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto): Promise<Record<string, unknown>> {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90);

    const productCode = `PRD-${Date.now()}`;

    const uniqueSuffix = `-${Math.random().toString(36).slice(2, 8)}`;
    const uniqueSlug = `${slug}${uniqueSuffix}`;

    return this.prisma.product.create({
      data: {
        name: dto.name,
        productCode,
        slug: uniqueSlug,
        basePrice: dto.price ?? 0,
        description: dto.description,
        images: dto.images ?? [],
        status: 'DRAFT',
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of ACTIVE products with their pricing preview.
   *
   * Filters:
   *  - label  → products must have the label with this slug attached
   *  - q      → case-insensitive contains match on product name OR productCode
   */
  async listProducts(dto: ListProductsDto, sellerId: string): Promise<{
    data: ProductCardDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, MAX_PAGE_LIMIT);
    const skip = (page - 1) * limit;

    // Build Prisma where clause
    const where = this.buildListWhere(dto);

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          productCode: true,
          name: true,
          slug: true,
          basePrice: true,
          createdAt: true,
          // Active pricing rules (may be multiple, we pick the latest)
          pricingRules: {
            where: {
              isActive: true,
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveUntil: null },
                { effectiveUntil: { gt: new Date() } },
              ],
            },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            select: {
              suggestedRetail: true,
              sellerTakePercent: true,
              sellerTakeFixed: true,
            },
          },
          images: true, // JSON field fallback for heroImageUrl
          // Hero image: first isCurrent thumbnail, or first thumbnail
          assetThumbs: {
            orderBy: [{ isCurrent: 'desc' }, { position: 'asc' }],
            take: 1,
            select: { url: true },
          },
          labels: {
            select: {
              label: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // ── Seller-scoped stats (ordersCount + revenue) per product ───────────────
    const statsMap = await this.fetchProductStats(products.map(p => p.id), sellerId);

    return {
      data: products.map((p) => ({
        ...this.mapToCard(p),
        stats: statsMap.get(p.id) ?? { ordersCount: 0, revenue: 0, spend: 0, roas: 0 },
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Fetches per-product order count + revenue for the given seller.
   * Uses Prisma groupBy on OrderItem filtered by the seller's orders.
   * Returns a Map<productId, ProductStatsDto>.
   *
   * Phase 1: spend = 0, roas = 0 (no Product→Campaign→AdStatsDaily link yet).
   */
  private async fetchProductStats(
    productIds: string[],
    sellerId: string,
  ): Promise<Map<string, ProductStatsDto>> {
    if (productIds.length === 0) return new Map();

    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: { sellerId },
      },
      _sum: { lineTotal: true },
      // Counts OrderItem rows per productId — equivalent to ordersCount when
      // each order has at most one line per product (standard e-commerce pattern).
      _count: { orderId: true },
    });

    const map = new Map<string, ProductStatsDto>();
    for (const row of rows) {
      if (!row.productId) continue;
      const revenue = Number(row._sum.lineTotal ?? 0);
      map.set(row.productId, {
        ordersCount: row._count.orderId,
        revenue,
        spend: 0,
        roas: safeDivide(revenue, 0), // always 0 in Phase 1
      });
    }
    return map;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns full product detail including variants.
   * Throws 404 if product not found or not ACTIVE.
   */
  async getProduct(id: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        productCode: true,
        name: true,
        slug: true,
        basePrice: true,
        compareAtPrice: true,
        currency: true,
        description: true,
        descriptionBlocks: true,
        shippingInfo: true,
        tags: true,
        images: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        pricingRules: {
          where: {
            isActive: true,
            effectiveFrom: { lte: new Date() },
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gt: new Date() } },
            ],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: {
            suggestedRetail: true,
            sellerTakePercent: true,
            sellerTakeFixed: true,
          },
        },
        assetThumbs: {
          orderBy: [{ isCurrent: 'desc' }, { position: 'asc' }],
          take: 1,
          select: { url: true },
        },
        labels: {
          select: {
            label: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            priceOverride: true,
            compareAtPrice: true,
            options: true,
            stockQuantity: true,
            isActive: true,
            position: true,
          },
        },
        sellpages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            slug: true,
            variant: true,
            status: true,
            titleOverride: true,
            descriptionOverride: true,
            sections: true,
          },
        },
      },
    });

    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException('Product not found');
    }

    const card = this.mapToCard(product);

    return {
      ...card,
      productCode: product.productCode,
      description: product.description,
      descriptionBlocks: product.descriptionBlocks as unknown[],
      shippingInfo: product.shippingInfo as Record<string, unknown>,
      tags: product.tags as string[],
      currency: product.currency,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      variants: product.variants.map((v) =>
        this.mapToVariant(v, product.basePrice),
      ),
      sellpages: product.sellpages.map((sp) => ({
        id: sp.id,
        slug: sp.slug,
        variant: sp.variant,
        status: sp.status,
        titleOverride: sp.titleOverride,
        descriptionOverride: sp.descriptionOverride,
        sections: sp.sections as unknown[],
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANTS (separate endpoint)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns active variants for the given product.
   * Throws 404 if product not found or not ACTIVE.
   */
  async getVariants(productId: string): Promise<ProductVariantDto[]> {
    // Verify product exists and is active
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, basePrice: true },
    });

    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException('Product not found');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isActive: true },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        priceOverride: true,
        compareAtPrice: true,
        options: true,
        stockQuantity: true,
        isActive: true,
        position: true,
      },
    });

    return variants.map((v) => this.mapToVariant(v, product.basePrice));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private buildListWhere(dto: ListProductsDto) {
    // Only ACTIVE products are visible in the catalog
    const conditions: Record<string, unknown>[] = [{ status: 'ACTIVE' }];

    if (dto.label) {
      conditions.push({
        labels: {
          some: {
            label: { slug: dto.label },
          },
        },
      });
    }

    if (dto.q) {
      const searchTerm = dto.q.trim();
      conditions.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { productCode: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    return { AND: conditions };
  }

  /**
   * Maps a Prisma product row (with pricingRules + assetThumbs + labels)
   * to a ProductCardDto.
   *
   * youTakeEstimate computation:
   *   - If active rule has sellerTakeFixed set  → use fixed amount directly
   *   - Else                                    → suggestedRetail * (sellerTakePercent / 100)
   *   - If no active rule                       → null
   *
   * All Decimal fields are converted to plain numbers via Number() before
   * returning, so JSON serialization never produces Prisma Decimal objects
   * (which can appear as {} and cause $NaN in the frontend).
   */
  private mapToCard(product: {
    id: string;
    productCode: string;
    name: string;
    slug: string;
    basePrice: { toNumber(): number } | number;
    pricingRules: Array<{
      suggestedRetail: { toNumber(): number } | number;
      sellerTakePercent: { toNumber(): number } | number;
      sellerTakeFixed: ({ toNumber(): number } | number) | null;
    }>;
    assetThumbs: Array<{ url: string }>;
    images?: unknown;
    labels: Array<{ label: { id: string; name: string; slug: string } }>;
  }): ProductCardDto {
    const rule = product.pricingRules[0] ?? null;

    // Convert Prisma Decimals to plain JS numbers first to avoid {} serialization
    const basePrice = Number(product.basePrice);
    const suggestedRetail = rule ? Number(rule.suggestedRetail) : basePrice;

    // suggestedRetailPrice: prefer pricing rule's suggested retail, else product basePrice
    const suggestedRetailPrice = suggestedRetail.toFixed(2);

    // youTakeEstimate — deterministic, no order/ad-spend involved
    let youTakeEstimate: string | null = null;
    if (rule) {
      if (rule.sellerTakeFixed !== null) {
        // Fixed override takes precedence over percentage
        youTakeEstimate = Number(rule.sellerTakeFixed).toFixed(2);
      } else {
        // Percentage of suggested retail
        const pct = Number(rule.sellerTakePercent) / 100;
        const estimate = suggestedRetail * pct;
        youTakeEstimate = estimate.toFixed(2);
      }
    }

    // Hero image: prefer assetThumbs, fallback to product.images JSON field
    let heroImageUrl: string | null = null;
    if (product.assetThumbs.length > 0) {
      heroImageUrl = product.assetThumbs[0].url;
    } else if (Array.isArray(product.images) && (product.images as string[]).length > 0) {
      heroImageUrl = (product.images as string[])[0];
    }

    const labels: ProductLabelDto[] = product.labels.map((pl) => ({
      id: pl.label.id,
      name: pl.label.name,
      slug: pl.label.slug,
    }));

    return {
      id: product.id,
      code: product.productCode,
      name: product.name,
      slug: product.slug,
      heroImageUrl,
      suggestedRetailPrice,
      youTakeEstimate,
      labels,
    };
  }

  /**
   * Maps a Prisma variant row to ProductVariantDto.
   *
   * effectivePrice = priceOverride if set, else product.basePrice
   * Decimal fields converted to Number to prevent {} JSON serialization.
   */
  private mapToVariant(
    variant: {
      id: string;
      name: string;
      sku: string | null;
      priceOverride: ({ toNumber(): number } | number) | null;
      compareAtPrice: ({ toNumber(): number } | number) | null;
      options: unknown;
      stockQuantity: number;
      isActive: boolean;
      position: number;
    },
    basePrice: { toNumber(): number } | number,
  ): ProductVariantDto {
    const effectivePrice =
      variant.priceOverride !== null
        ? Number(variant.priceOverride).toFixed(2)
        : Number(basePrice).toFixed(2);

    return {
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      effectivePrice,
      compareAtPrice: variant.compareAtPrice != null
        ? Number(variant.compareAtPrice).toFixed(2)
        : null,
      options: variant.options as Record<string, unknown>,
      stockQuantity: variant.stockQuantity,
      isActive: variant.isActive,
      position: variant.position,
    };
  }
}
