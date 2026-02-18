import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductCardDto, ProductLabelDto } from './dto/product-card.dto';
import { ProductDetailDto, ProductVariantDto } from './dto/product-detail.dto';
import { ListProductsDto } from './dto/list-products.dto';

/** Maximum rows per page regardless of caller-supplied limit. */
const MAX_PAGE_LIMIT = 100;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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
  async listProducts(dto: ListProductsDto): Promise<{
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

    return {
      data: products.map((p) => this.mapToCard(p)),
      total,
      page,
      limit,
    };
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
   */
  private mapToCard(product: {
    id: string;
    productCode: string;
    name: string;
    slug: string;
    basePrice: { toString(): string };
    pricingRules: Array<{
      suggestedRetail: { toString(): string };
      sellerTakePercent: { toString(): string };
      sellerTakeFixed: { toString(): string } | null;
    }>;
    assetThumbs: Array<{ url: string }>;
    labels: Array<{ label: { id: string; name: string; slug: string } }>;
  }): ProductCardDto {
    const rule = product.pricingRules[0] ?? null;

    // suggestedRetailPrice: prefer pricing rule's suggested retail, else product basePrice
    const suggestedRetailPrice = rule
      ? rule.suggestedRetail.toString()
      : product.basePrice.toString();

    // youTakeEstimate — deterministic, no order/ad-spend involved
    let youTakeEstimate: string | null = null;
    if (rule) {
      if (rule.sellerTakeFixed !== null) {
        // Fixed override takes precedence over percentage
        youTakeEstimate = rule.sellerTakeFixed.toString();
      } else {
        // Percentage of suggested retail
        const pct = Number(rule.sellerTakePercent) / 100;
        const estimate = Number(rule.suggestedRetail) * pct;
        // Round to 2 decimal places, return as string (consistent with Prisma { toString(): string })
        youTakeEstimate = estimate.toFixed(2);
      }
    }

    const heroImageUrl =
      product.assetThumbs.length > 0 ? product.assetThumbs[0].url : null;

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
   */
  private mapToVariant(
    variant: {
      id: string;
      name: string;
      sku: string | null;
      priceOverride: { toString(): string } | null;
      compareAtPrice: { toString(): string } | null;
      options: unknown;
      stockQuantity: number;
      isActive: boolean;
      position: number;
    },
    basePrice: { toString(): string },
  ): ProductVariantDto {
    const effectivePrice =
      variant.priceOverride !== null
        ? variant.priceOverride.toString()
        : basePrice.toString();

    return {
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      effectivePrice,
      compareAtPrice: variant.compareAtPrice?.toString() ?? null,
      options: variant.options as Record<string, unknown>,
      stockQuantity: variant.stockQuantity,
      isActive: variant.isActive,
      position: variant.position,
    };
  }
}
