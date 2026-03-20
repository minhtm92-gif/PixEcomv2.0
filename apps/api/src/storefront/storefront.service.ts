import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto, ConfirmPaymentDto } from './dto/checkout.dto';
import { TrackEventDto } from './dto/track-event.dto';
import { StripePaymentService } from './payments/stripe.service';
import { PayPalPaymentService, PayPalGatewayConfig } from './payments/paypal.service';
import { ReviewsService } from './reviews.service';
import { EmailService } from '../email/email.service';
import { WebhookOutboundService } from '../webhook-outbound/webhook-outbound.service';

// ─── Shipping cost config ──────────────────────────────────────────────────
const SHIPPING_COSTS: Record<string, number> = {
  standard: 4.99,
  express: 12.99,
  overnight: 24.99,
};
const FREE_SHIPPING_THRESHOLD = 50;

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripePaymentService,
    private readonly paypal: PayPalPaymentService,
    private readonly reviewsSvc: ReviewsService,
    private readonly email: EmailService,
    private readonly webhookOutbound: WebhookOutboundService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LEGAL PAGES (from platform settings)
  // ─────────────────────────────────────────────────────────────────────────

  async getLegalPages(): Promise<Record<string, unknown>> {
    const settings = await this.prisma.platformSettings.findFirst({
      select: { legalPages: true },
    });
    const pages = (settings?.legalPages ?? {}) as Record<string, any>;

    // Filter to published pages only
    const result: Record<string, any> = {};
    for (const [slug, doc] of Object.entries(pages)) {
      if (doc && doc.status !== 'Draft') {
        result[slug] = doc;
      }
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SITEMAP DATA (lightweight, for sitemap.xml generation)
  // ─────────────────────────────────────────────────────────────────────────

  async getSitemapData() {
    const sellers = await this.prisma.seller.findMany({
      where: { isActive: true, status: 'ACTIVE' },
      select: {
        slug: true,
        updatedAt: true,
        sellpages: {
          where: { status: 'PUBLISHED' },
          select: {
            slug: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      sellers: sellers.map((s) => ({
        slug: s.slug,
        updatedAt: s.updatedAt.toISOString(),
        sellpages: s.sellpages.map((sp) => ({
          slug: sp.slug,
          updatedAt: sp.updatedAt.toISOString(),
        })),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESOLVE CUSTOM DOMAIN → SELLER SLUG
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Given a custom domain hostname (e.g. "jal2.com"), returns the seller slug
   * that owns it. Used by Next.js middleware for custom domain routing.
   */
  async resolveDomain(hostname: string) {
    if (!hostname) {
      throw new BadRequestException('hostname query parameter is required');
    }

    const normalized = hostname.trim().toLowerCase();

    const domain = await this.prisma.sellerDomain.findFirst({
      where: { hostname: normalized, status: 'VERIFIED' },
      select: {
        id: true,
        hostname: true,
        seller: {
          select: {
            slug: true,
            isActive: true,
            status: true,
          },
        },
      },
    });

    if (!domain || !domain.seller.isActive || domain.seller.status !== 'ACTIVE') {
      throw new NotFoundException(`No active store found for domain "${normalized}"`);
    }

    return {
      hostname: domain.hostname,
      sellerSlug: domain.seller.slug,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STORE HOMEPAGE
  // ─────────────────────────────────────────────────────────────────────────

  async getStore(sellerSlug: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { slug: sellerSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        faviconUrl: true,
        isActive: true,
        status: true,
        settings: {
          select: {
            brandName: true,
            defaultCurrency: true,
            supportEmail: true,
          },
        },
      },
    });

    if (!seller || !seller.isActive || seller.status !== 'ACTIVE') {
      throw new NotFoundException('Store not found');
    }

    // Fetch published sellpages with product data
    const sellpages = await this.prisma.sellpage.findMany({
      where: { sellerId: seller.id, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      select: {
        slug: true,
        titleOverride: true,
        descriptionOverride: true,
        sections: true,
        boostModules: true,
        product: {
          select: {
            name: true,
            basePrice: true,
            compareAtPrice: true,
            rating: true,
            reviewCount: true,
            images: true,
            assetThumbs: {
              orderBy: [{ isCurrent: 'desc' as const }, { position: 'asc' as const }],
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });

    return {
      store: {
        name: seller.settings?.brandName ?? seller.name,
        slug: seller.slug,
        logoUrl: seller.logoUrl,
        faviconUrl: seller.faviconUrl,
        currency: seller.settings?.defaultCurrency ?? 'USD',
      },
      sellpages: sellpages.map((sp) => ({
        slug: sp.slug,
        title: sp.titleOverride ?? sp.product.name,
        product: {
          name: sp.product.name,
          basePrice: Number(sp.product.basePrice),
          compareAtPrice: sp.product.compareAtPrice
            ? Number(sp.product.compareAtPrice)
            : null,
          heroImage: sp.product.assetThumbs[0]?.url
            ?? (Array.isArray(sp.product.images) && (sp.product.images as string[]).length > 0
              ? (sp.product.images as string[])[0]
              : null),
          rating: Number(sp.product.rating),
          reviewCount: sp.product.reviewCount,
        },
        category: extractCategory(sp.sections),
        badge: null,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELLPAGE DETAIL
  // ─────────────────────────────────────────────────────────────────────────

  async getSellpage(sellerSlug: string, sellpageSlug: string) {
    const seller = await this.resolveActiveSeller(sellerSlug);

    const sellpage = await this.prisma.sellpage.findUnique({
      where: {
        uq_sellpage_slug: { sellerId: seller.id, slug: sellpageSlug },
      },
      select: {
        id: true,
        slug: true,
        titleOverride: true,
        descriptionOverride: true,
        seoTitle: true,
        seoDescription: true,
        seoOgImage: true,
        boostModules: true,
        headerConfig: true,
        footerConfig: true,
        sections: true,
        status: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            compareAtPrice: true,
            currency: true,
            description: true,
            descriptionBlocks: true,
            shippingInfo: true,
            images: true,
            rating: true,
            reviewCount: true,
            allowOutOfStockPurchase: true,
            assetMedia: {
              where: { isCurrent: true },
              orderBy: { position: 'asc' },
              select: { url: true },
            },
            assetThumbs: {
              where: { isCurrent: true },
              orderBy: { position: 'asc' },
              select: { url: true },
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
                image: true,
              },
            },
          },
        },
        discounts: {
          where: {
            status: 'ACTIVE',
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          select: {
            id: true,
            code: true,
            type: true,
            value: true,
          },
        },
      },
    });

    if (!sellpage || sellpage.status !== 'PUBLISHED') {
      throw new NotFoundException('Page not found');
    }

    // Fetch social proof from SellpageStatsDaily (last 7 days)
    const [socialProof, reviews] = await Promise.all([
      this.getSocialProof(seller.id, sellpage.id),
      this.reviewsSvc.getProductReviews(sellpage.product.id),
    ]);

    // Resolve Meta Pixel ID: first try SellerSettings, fallback to FbConnection(PIXEL)
    let pixelId: string | null = null;
    const sellerSettings = await this.prisma.sellerSettings.findUnique({
      where: { sellerId: seller.id },
      select: { metaPixelId: true },
    });
    if (sellerSettings?.metaPixelId) {
      pixelId = sellerSettings.metaPixelId;
    } else {
      const fbPixel = await this.prisma.fbConnection.findFirst({
        where: {
          sellerId: seller.id,
          connectionType: 'PIXEL',
          isActive: true,
        },
        select: { externalId: true },
        orderBy: { createdAt: 'desc' },
      });
      if (fbPixel) {
        pixelId = fbPixel.externalId;
      }
    }

    return {
      sellpage: {
        id: sellpage.id,
        slug: sellpage.slug,
        title: sellpage.titleOverride ?? sellpage.product.name,
        description: sellpage.descriptionOverride ?? sellpage.product.description ?? '',
        seoTitle: sellpage.seoTitle,
        seoDescription: sellpage.seoDescription,
        seoOgImage: sellpage.seoOgImage,
        boostModules: (sellpage.boostModules ?? []) as unknown[],
        headerConfig: (sellpage.headerConfig ?? {}) as Record<string, unknown>,
        footerConfig: (sellpage.footerConfig ?? {}) as Record<string, unknown>,
      },
      product: {
        id: sellpage.product.id,
        name: sellpage.product.name,
        slug: sellpage.product.slug,
        basePrice: Number(sellpage.product.basePrice),
        compareAtPrice: sellpage.product.compareAtPrice
          ? Number(sellpage.product.compareAtPrice)
          : null,
        currency: sellpage.product.currency,
        description: sellpage.product.description ?? '',
        descriptionBlocks: (sellpage.product.descriptionBlocks ?? []) as unknown[],
        shippingInfo: (sellpage.product.shippingInfo ?? {}) as Record<string, unknown>,
        rating: Number(sellpage.product.rating),
        reviewCount: sellpage.product.reviewCount,
        allowOutOfStockPurchase: sellpage.product.allowOutOfStockPurchase,
        images: sellpage.product.assetMedia.length > 0
          ? sellpage.product.assetMedia.map((m) => m.url)
          : (Array.isArray(sellpage.product.images) ? sellpage.product.images as string[] : []),
        thumbnails: sellpage.product.assetThumbs.length > 0
          ? sellpage.product.assetThumbs.map((t) => t.url)
          : (Array.isArray(sellpage.product.images) ? sellpage.product.images as string[] : []),
        variants: sellpage.product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          options: (v.options ?? {}) as Record<string, unknown>,
          stockQuantity: v.stockQuantity,
          isActive: v.isActive,
          image: v.image ?? null,
        })),
      },
      store: {
        name: seller.name,
        slug: seller.slug,
        logoUrl: seller.logoUrl,
        faviconUrl: seller.faviconUrl,
        currency: seller.settings?.defaultCurrency ?? 'USD',
      },
      discounts: (sellpage.discounts ?? []).map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type as 'PERCENT' | 'FIXED',
        value: Number(d.value),
        label:
          d.type === 'PERCENT'
            ? `${Number(d.value)}% OFF`
            : `$${Number(d.value)} OFF`,
      })),
      reviews,
      socialProof,
      tracking: {
        pixelId,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  async trackOrder(sellerSlug: string, orderNumber: string, email: string) {
    const seller = await this.resolveActiveSeller(sellerSlug);

    const order = await this.prisma.order.findFirst({
      where: {
        sellerId: seller.id,
        orderNumber,
        customerEmail: { equals: email, mode: 'insensitive' },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerEmail: true,
        total: true,
        currency: true,
        trackingNumber: true,
        trackingUrl: true,
        shippingAddress: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            variantName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          select: {
            eventType: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Order not found. Please check your order number and email.',
      );
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      total: Number(order.total),
      currency: order.currency,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippingAddress: (order.shippingAddress ?? {}) as Record<string, unknown>,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      timeline: order.events.map((e) => ({
        type: e.eventType,
        description: e.description,
        at: e.createdAt.toISOString(),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHECKOUT
  // ─────────────────────────────────────────────────────────────────────────

  async checkout(sellerSlug: string, dto: CheckoutDto) {
    const seller = await this.resolveActiveSeller(sellerSlug);

    // Resolve sellpage (include boostModules + headerConfig for upsell discount & shipping)
    const sellpage = await this.prisma.sellpage.findUnique({
      where: {
        uq_sellpage_slug: { sellerId: seller.id, slug: dto.sellpageSlug },
      },
      select: { id: true, status: true, boostModules: true, headerConfig: true },
    });
    if (!sellpage || sellpage.status !== 'PUBLISHED') {
      throw new BadRequestException('Sellpage not found or not published');
    }

    // Validate items + compute pricing
    let subtotal = 0;
    const orderItems: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      variantName: string | null;
      sku: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, basePrice: true, compareAtPrice: true, status: true, allowOutOfStockPurchase: true },
      });
      if (!product || product.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Product ${item.productId} not found or inactive`,
        );
      }

      let unitPrice = Number(product.basePrice);
      let variantName: string | null = null;
      let variantSku: string | null = null;

      if (item.variantId) {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          select: {
            id: true,
            name: true,
            sku: true,
            priceOverride: true,
            stockQuantity: true,
            isActive: true,
            productId: true,
          },
        });
        if (!variant || !variant.isActive || variant.productId !== product.id) {
          throw new BadRequestException(
            `Variant ${item.variantId} not found or inactive`,
          );
        }
        if (!product.allowOutOfStockPurchase && variant.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for variant ${variant.name}`,
          );
        }
        if (variant.priceOverride) {
          unitPrice = Number(variant.priceOverride);
        }
        variantName = variant.name;
        variantSku = variant.sku;
      }

      // Apply upsell discount from sellpage boostModules
      const boostModules = (sellpage.boostModules ?? []) as any[];
      const upsellModule = boostModules.find(
        (m: any) => m.type === 'UPSELL_NEXT_ITEM' && m.enabled !== false,
      );
      if (upsellModule?.discountTiers?.length > 0 && product.compareAtPrice) {
        const comparePrice = Number(product.compareAtPrice);
        const sortedTiers = [...upsellModule.discountTiers].sort(
          (a: any, b: any) => b.quantity - a.quantity,
        );
        const matched = sortedTiers.find(
          (t: any) => item.quantity >= t.quantity,
        );
        if (matched) {
          const upsellPrice =
            Math.round(comparePrice * (1 - matched.discount / 100) * 100) / 100;
          unitPrice = upsellPrice;
        }
      }

      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      subtotal += lineTotal;

      orderItems.push({
        productId: product.id,
        variantId: item.variantId ?? null,
        productName: product.name,
        variantName,
        sku: variantSku,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    // Shipping cost — use sellpage config if available, fallback to hardcoded
    const headerConfig = (sellpage.headerConfig ?? {}) as Record<string, any>;
    const spShipping = headerConfig.shipping as
      | { label: string; price: number; freeThreshold?: number }
      | undefined;

    let shippingCost: number;
    if (spShipping?.price != null) {
      const freeAt = spShipping.freeThreshold ?? Infinity;
      shippingCost = subtotal >= freeAt ? 0 : spShipping.price;
    } else {
      shippingCost =
        dto.shippingMethod === 'standard' && subtotal >= FREE_SHIPPING_THRESHOLD
          ? 0
          : SHIPPING_COSTS[dto.shippingMethod] ?? 4.99;
    }

    // Discount
    let discountAmount = 0;
    if (dto.discountId) {
      const discount = await this.prisma.discount.findUnique({
        where: { id: dto.discountId },
        select: {
          id: true,
          type: true,
          value: true,
          status: true,
          uses: true,
          usageLimit: true,
          expiresAt: true,
          sellpageId: true,
        },
      });

      if (
        discount &&
        discount.status === 'ACTIVE' &&
        (!discount.expiresAt || discount.expiresAt > new Date()) &&
        (!discount.usageLimit || discount.uses < discount.usageLimit) &&
        (!discount.sellpageId || discount.sellpageId === sellpage.id)
      ) {
        if (discount.type === 'PERCENT') {
          discountAmount = (subtotal * Number(discount.value)) / 100;
        } else {
          discountAmount = Number(discount.value);
        }
        discountAmount = Math.min(discountAmount, subtotal);
      }
    }

    const total = Math.round(Math.max(0, subtotal + shippingCost - discountAmount) * 100) / 100;
    const currency = seller.settings?.defaultCurrency ?? 'USD';

    // Generate order number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderNumber = `ORD-${dateStr}-${rand}`;

    // Create Order + OrderItems + OrderEvent in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          sellerId: seller.id,
          sellpageId: sellpage.id,
          orderNumber,
          customerEmail: dto.customerEmail,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone ?? null,
          shippingAddress: dto.shippingAddress as unknown as any,
          billingAddress: dto.billingAddress
            ? (dto.billingAddress as unknown as any)
            : null,
          subtotal,
          shippingCost,
          taxAmount: 0,
          discountAmount,
          total,
          currency,
          status: 'PENDING',
          paymentMethod: dto.paymentMethod,
          source: dto.source ?? 'storefront',
          utmSource: dto.utmSource ?? null,
          utmMedium: dto.utmMedium ?? null,
          utmCampaign: dto.utmCampaign ?? null,
          utmTerm: dto.utmTerm ?? null,
          utmContent: dto.utmContent ?? null,
          items: {
            create: orderItems.map((oi) => ({
              productId: oi.productId,
              variantId: oi.variantId,
              productName: oi.productName,
              variantName: oi.variantName,
              sku: oi.sku,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              lineTotal: oi.lineTotal,
            })),
          },
        },
        select: { id: true, orderNumber: true },
      });

      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          sellerId: seller.id,
          eventType: 'CREATED',
          description: 'Order created from storefront checkout',
        },
      });

      // Increment discount usage
      if (dto.discountId) {
        await tx.discount.update({
          where: { id: dto.discountId },
          data: { uses: { increment: 1 } },
        });
      }

      return created;
    });

    // Dispatch outbound webhook for order creation (fire-and-forget)
    this.webhookOutbound.dispatchOrderEvent(seller.id, 'order.created', order.id).catch(() => {});

    // Initiate payment
    const metadata = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      sellerSlug,
    };

    if (dto.paymentMethod === 'stripe') {
      const { clientSecret, paymentIntentId } =
        await this.stripe.createPaymentIntent(total, currency, metadata);

      // Store paymentId for later verification
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentId: paymentIntentId },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total,
        payment: { type: 'stripe' as const, clientSecret },
      };
    } else {
      // Resolve seller's PayPal gateway credentials
      const paypalConfig = this.resolvePayPalConfig(seller.paypalGateway);
      if (!paypalConfig) {
        throw new BadRequestException('Seller has no PayPal gateway configured');
      }

      const { paypalOrderId, approvalUrl } = await this.paypal.createOrder(
        total,
        currency,
        metadata,
        paypalConfig,
      );

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentId: paypalOrderId,
          paymentGatewayId: seller.paypalGateway?.id ?? null,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total,
        payment: { type: 'paypal' as const, paypalOrderId, approvalUrl },
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────

  async confirmPayment(
    sellerSlug: string,
    orderId: string,
    dto: ConfirmPaymentDto,
  ) {
    const seller = await this.resolveActiveSeller(sellerSlug);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId: seller.id },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentId: true,
        paymentGatewayId: true,
        orderNumber: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order is not pending payment');
    }

    let transactionId: string;

    if (order.paymentMethod === 'stripe') {
      const piId = dto.paymentIntentId ?? order.paymentId;
      if (!piId) {
        throw new BadRequestException('Missing payment intent ID');
      }
      const pi = await this.stripe.retrievePaymentIntent(piId);
      if (pi.status !== 'succeeded') {
        throw new BadRequestException(
          `Payment not completed. Status: ${pi.status}`,
        );
      }
      transactionId = pi.id;
    } else {
      const ppId = dto.paypalOrderId ?? order.paymentId;
      if (!ppId) {
        throw new BadRequestException('Missing PayPal order ID');
      }

      // Resolve gateway config: from order's paymentGatewayId, or fallback to .env
      let captureGatewayConfig: PayPalGatewayConfig | undefined;
      if (order.paymentGatewayId) {
        const gateway = await this.prisma.paymentGateway.findUnique({
          where: { id: order.paymentGatewayId },
          select: { credentials: true, environment: true, status: true },
        });
        const resolved = this.resolvePayPalConfig(
          gateway as { credentials: unknown; environment: string; status: string } | null,
        );
        if (resolved) {
          captureGatewayConfig = resolved;
        }
      }

      const result = await this.paypal.captureOrder(ppId, captureGatewayConfig);
      if (result.status !== 'COMPLETED') {
        throw new BadRequestException(
          `PayPal payment not completed. Status: ${result.status}`,
        );
      }
      transactionId = result.transactionId;
    }

    // Update order status + create event + decrement stock
    // Use updateMany with status filter for atomic race-condition safety:
    // if webhook already confirmed this order, rowCount === 0 and we skip.
    let confirmed = false;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          paidAt: new Date(),
          transactionId,
        },
      });

      if (count === 0) {
        // Another process (webhook) already confirmed — skip to avoid double-decrement
        this.logger.log(
          `Order ${order.orderNumber} already confirmed by webhook, skipping client confirm`,
        );
        return;
      }

      confirmed = true;

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          sellerId: seller.id,
          eventType: 'CONFIRMED',
          description: `Payment confirmed via ${order.paymentMethod}. Transaction: ${transactionId}`,
        },
      });

      // F.1.1: Decrement stock for each variant
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });
        }
      }
    });

    // Only send email + webhook if this process actually confirmed the order
    if (confirmed) {
      this.logger.log(
        `Order ${order.orderNumber} confirmed. Transaction: ${transactionId}`,
      );

      // F.3: Send order confirmation email (fire-and-forget, never blocks response)
      this.sendOrderConfirmationEmail(order.id, seller.slug).catch((err) =>
        this.logger.error(`Failed to queue confirmation email: ${err.message}`),
      );

      // Dispatch outbound webhook (fire-and-forget)
      this.webhookOutbound.dispatchOrderEvent(seller.id, 'order.confirmed', orderId).catch(() => {});
    }

    return {
      success: true,
      orderNumber: order.orderNumber,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STOREFRONT EVENT TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  // Known bot user-agent patterns
  private static readonly BOT_PATTERNS = [
    'meta-externalads', 'facebookexternalhit', 'facebot',
    'googlebot', 'bingbot', 'bytespider', 'petalbot',
    'yandexbot', 'ahrefsbot', 'semrushbot', 'dotbot',
    'headlesschrome', 'phantomjs', 'prerender', 'crawler',
    'spider', 'slurp', 'mediapartners',
  ];

  private isBot(userAgent?: string): boolean {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return StorefrontService.BOT_PATTERNS.some(p => ua.includes(p));
  }

  async trackEvent(sellerSlug: string, dto: TrackEventDto, userAgent?: string, ip?: string) {
    // 1. Filter bots
    if (this.isBot(userAgent)) {
      return { ok: false, reason: 'bot' };
    }

    // 2. Resolve seller
    const seller = await this.prisma.seller.findUnique({
      where: { slug: sellerSlug },
      select: { id: true },
    });
    if (!seller) return { ok: false };

    // 3. Resolve sellpage
    let sellpageId: string | null = null;
    if (dto.sellpageSlug) {
      const sp = await this.prisma.sellpage.findFirst({
        where: { slug: dto.sellpageSlug, sellerId: seller.id },
        select: { id: true },
      });
      sellpageId = sp?.id || null;
    }

    // 4. Hash IP for analytics (not PII)
    let ipHash: string | null = null;
    if (ip) {
      const crypto = require('crypto');
      ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
    }

    // 5. Insert event
    await this.prisma.storefrontEvent.create({
      data: {
        sellerId: seller.id,
        sellpageId,
        eventType: dto.event,
        productId: dto.productId || null,
        variantId: dto.variantId || null,
        value: dto.value || null,
        quantity: dto.quantity || null,
        sessionId: dto.sessionId || null,
        utmSource: dto.utmSource || null,
        utmCampaign: dto.utmCampaign || null,
        userAgent: userAgent?.substring(0, 500) || null,
        ipHash,
      },
    });

    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async resolveActiveSeller(slug: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        faviconUrl: true,
        isActive: true,
        status: true,
        settings: {
          select: {
            brandName: true,
            defaultCurrency: true,
          },
        },
        paypalGateway: {
          select: { id: true, credentials: true, environment: true, status: true },
        },
        creditCardGateway: {
          select: { id: true, credentials: true, environment: true, status: true },
        },
      },
    });

    if (!seller || !seller.isActive || seller.status !== 'ACTIVE') {
      throw new NotFoundException('Store not found');
    }

    return seller;
  }

  private resolvePayPalConfig(
    gateway: { credentials: unknown; environment: string; status: string } | null,
  ): PayPalGatewayConfig | null {
    if (!gateway || gateway.status !== 'ACTIVE') return null;
    const creds = gateway.credentials as { clientId?: string; clientSecret?: string } | null;
    if (!creds?.clientId || !creds?.clientSecret) return null;
    return {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      mode: gateway.environment === 'live' ? 'live' : 'sandbox',
    };
  }

  private async getSocialProof(
    sellerId: string,
    sellpageId: string,
  ): Promise<{ viewers: number; purchased: number }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stats = await this.prisma.sellpageStatsDaily.findMany({
      where: {
        sellerId,
        sellpageId,
        statDate: { gte: sevenDaysAgo },
      },
      select: {
        contentViews: true,
        purchases: true,
      },
    });

    let viewers = 0;
    let purchased = 0;
    for (const row of stats) {
      viewers += row.contentViews;
      purchased += row.purchases;
    }

    return { viewers, purchased };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // F.3: Order confirmation email helper
  // ─────────────────────────────────────────────────────────────────────────

  async sendOrderConfirmationEmail(
    orderId: string,
    sellerSlug: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        customerEmail: true,
        customerName: true,
        total: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        currency: true,
        paymentMethod: true,
        shippingAddress: true,
        seller: { select: { name: true, slug: true } },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });

    if (!order) return;

    const addr = (order.shippingAddress ?? {}) as Record<string, string>;

    await this.email.sendOrderConfirmation({
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? 'Customer',
      customerEmail: order.customerEmail,
      items: order.items.map((i) => ({
        productName: i.product?.name ?? 'Product',
        variantName: i.variant?.name ?? null,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      currency: order.currency,
      paymentMethod: order.paymentMethod ?? 'stripe',
      shippingAddress: {
        street: addr.line1 ?? addr.street ?? '',
        line2: addr.line2 ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
        zip: addr.postalCode ?? addr.zip ?? '',
        country: addr.country ?? '',
        countryCode: addr.countryCode ?? '',
      },
      storeName: order.seller.name,
      storeSlug: order.seller.slug,
    });
  }
}

function extractCategory(sections: unknown): string | null {
  if (!Array.isArray(sections)) return null;
  for (const section of sections) {
    if (
      section &&
      typeof section === 'object' &&
      'category' in section &&
      typeof (section as Record<string, unknown>).category === 'string'
    ) {
      return (section as Record<string, unknown>).category as string;
    }
  }
  return null;
}
