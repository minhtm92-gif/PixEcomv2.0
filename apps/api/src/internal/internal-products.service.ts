import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InternalProductsService {
  private readonly logger = new Logger(InternalProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a product from PixCon project data.
   * Called internally via API with X-Internal-Key header.
   */
  async createFromPixcon(data: {
    name: string;
    description?: string;
    images?: string[];
    optionDefinitions?: Array<{ name: string; values: string[] }>;
    variants?: Array<{
      name: string;
      sku?: string;
      price: number;
      compareAtPrice?: number;
      costPrice?: number;
      fulfillmentCost?: number;
      options?: Record<string, string>;
      image?: string;
    }>;
    quantityCosts?: Record<string, number>;
    allowOutOfStockPurchase?: boolean;
  }): Promise<Record<string, unknown>> {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90);

    const productCode = `PRD-${Date.now()}`;
    const uniqueSuffix = `-${Math.random().toString(36).slice(2, 8)}`;
    const uniqueSlug = `${slug}${uniqueSuffix}`;

    // Determine base price from first variant or 0
    const basePrice =
      data.variants && data.variants.length > 0 ? data.variants[0].price : 0;

    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        productCode,
        slug: uniqueSlug,
        basePrice,
        description: data.description ?? null,
        images: data.images ?? [],
        status: 'DRAFT',
        optionDefinitions: data.optionDefinitions
          ? data.optionDefinitions.map((d) => ({
              name: d.name,
              type: 'default',
              values: d.values,
            }))
          : [],
        quantityCosts: data.quantityCosts
          ? Object.entries(data.quantityCosts).map(([qty, cost]) => ({
              qty: parseInt(qty),
              cost,
            }))
          : [],
        allowOutOfStockPurchase: data.allowOutOfStockPurchase ?? true,
      },
    });

    // Create variants
    if (data.variants && data.variants.length > 0) {
      await this.prisma.productVariant.createMany({
        data: data.variants.map((v, idx) => ({
          productId: product.id,
          name: v.name,
          sku: v.sku ?? null,
          priceOverride: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          costPrice: v.costPrice ?? null,
          fulfillmentCost: v.fulfillmentCost ?? null,
          options: v.options ?? {},
          image: v.image ?? null,
          position: idx,
          stockQuantity: 0,
          isActive: true,
        })),
      });
    }

    this.logger.log(
      `Created product ${product.id} (${product.name}) from PixCon`,
    );

    return product;
  }

  /**
   * Create sellpages for a product from PixCon data.
   */
  async createSellpagesFromPixcon(
    productId: string,
    sellerId: string,
    sellpages: Array<{
      slug: string;
      variant?: string;
      titleOverride?: string;
      descriptionOverride?: string;
      seoTitle?: string;
      seoDescription?: string;
      seoOgImage?: string;
      sections?: unknown;
      headerConfig?: unknown;
      footerConfig?: unknown;
      boostModules?: unknown;
      discountRules?: unknown;
      pixconSellpageId?: string;
    }>,
  ): Promise<Array<Record<string, unknown>>> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { id: true },
    });
    if (!seller) {
      throw new Error(`Seller ${sellerId} not found`);
    }

    const created = [];
    for (const sp of sellpages) {
      // Ensure unique slug per seller
      const uniqueSuffix = `-${Math.random().toString(36).slice(2, 8)}`;
      const slug = sp.slug
        ? `${sp.slug}${uniqueSuffix}`
        : `${productId.slice(0, 8)}${uniqueSuffix}`;

      const sellpage = await this.prisma.sellpage.create({
        data: {
          sellerId,
          productId,
          slug,
          variant: sp.variant ?? null,
          titleOverride: sp.titleOverride ?? null,
          descriptionOverride: sp.descriptionOverride ?? null,
          seoTitle: sp.seoTitle ?? null,
          seoDescription: sp.seoDescription ?? null,
          seoOgImage: sp.seoOgImage ?? null,
          sections: (sp.sections as any) ?? [],
          headerConfig: (sp.headerConfig as any) ?? {},
          footerConfig: (sp.footerConfig as any) ?? {},
          boostModules: (sp.boostModules as any) ?? [],
          discountRules: (sp.discountRules as any) ?? [],
          status: 'DRAFT',
        },
      });
      created.push(sellpage);
    }

    // Sync sellpage content into Product description (Sellpage = Product Description)
    // Build rich HTML from the first sellpage's sections (including images)
    const primary = sellpages[0];
    if (primary) {
      const sections = (primary.sections as Array<{ content?: string; imageUrl?: string }>) ?? [];
      const htmlParts = sections.map((s) => {
        let html = s.content ?? '';
        if (s.imageUrl) {
          html += `<img src="${s.imageUrl}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0" />`;
        }
        return html;
      });
      const fullHtml = htmlParts.join('');

      const descriptionBlocks = sellpages.map((sp) => ({
        variant: sp.variant ?? null,
        headline: sp.titleOverride ?? null,
        subheadline: sp.descriptionOverride ?? null,
        sections: sp.sections ?? [],
      }));

      await this.prisma.product.update({
        where: { id: productId },
        data: {
          description: fullHtml || primary.titleOverride || primary.descriptionOverride || null,
          descriptionBlocks: descriptionBlocks as any,
        },
      });
    }

    this.logger.log(
      `Created ${created.length} sellpages for product ${productId} from PixCon`,
    );

    return created;
  }

  /**
   * Add videos to a product (from PixCon approved briefs).
   */
  async addVideos(
    productId: string,
    videos: Array<{
      url: string;
      filename?: string;
      durationSec?: number;
      fileSize?: number;
    }>,
  ): Promise<any[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Get next version number
    const latest = await this.prisma.assetMedia.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });
    const version = latest?.version ?? 'v1';

    // Get max position
    const maxPos = await this.prisma.assetMedia.findFirst({
      where: { productId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let nextPos = (maxPos?.position ?? -1) + 1;

    const created = [];
    for (const video of videos) {
      const media = await this.prisma.assetMedia.create({
        data: {
          productId,
          version,
          url: video.url,
          mediaType: 'VIDEO',
          durationSec: video.durationSec ?? null,
          fileSize: video.fileSize ?? null,
          position: nextPos++,
          isCurrent: true,
        },
      });
      created.push(media);
    }

    this.logger.log(
      `Added ${created.length} videos to product ${productId}`,
    );

    return created;
  }
}
