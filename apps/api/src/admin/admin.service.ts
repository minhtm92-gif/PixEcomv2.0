import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { BulkUpdateVariantsDto } from './dto/bulk-update-variants.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const BCRYPT_COST = 12;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────

  async getDashboard(): Promise<any> {
    // Date range for "last 7 days" analytics
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalSellers,
      activeSellers,
      pendingApprovals,
      totalProducts,
      totalOrders,
      totalRevenue,
      totalUsers,
      recentOrders,
      revenueByDay,
      topSellerStats,
    ] = await Promise.all([
      this.prisma.seller.count(),
      this.prisma.seller.count({ where: { status: 'ACTIVE' } }),
      this.prisma.seller.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ _sum: { total: true } }),
      this.prisma.user.count(),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
          seller: { select: { id: true, name: true } },
        },
      }),
      // Revenue by day (last 7 days) from sellpage stats
      this.prisma.$queryRaw`
        SELECT
          DATE(stat_date) as date,
          COALESCE(SUM(revenue), 0)::float as revenue,
          COALESCE(SUM(orders_count), 0)::int as orders
        FROM sellpage_stats_daily
        WHERE stat_date >= ${sevenDaysAgo}
        GROUP BY DATE(stat_date)
        ORDER BY date ASC
      ` as Promise<Array<{ date: Date; revenue: number; orders: number }>>,
      // Top sellers by revenue
      this.prisma.order.groupBy({
        by: ['sellerId'],
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    // Enrich top sellers with names + ROAS
    const topSellerIds = topSellerStats.map((s) => s.sellerId);
    const sellerDetails = topSellerIds.length > 0
      ? await this.prisma.seller.findMany({
          where: { id: { in: topSellerIds } },
          select: { id: true, name: true },
        })
      : [];
    const sellerNameMap = new Map(sellerDetails.map((s) => [s.id, s.name]));

    // Get ad spend per seller for ROAS
    const sellerSpend = topSellerIds.length > 0
      ? await this.prisma.adStatsDaily.groupBy({
          by: ['sellerId'],
          where: { sellerId: { in: topSellerIds } },
          _sum: { spend: true, purchaseValue: true },
        })
      : [];
    const spendMap = new Map(sellerSpend.map((s) => [s.sellerId, { spend: Number(s._sum.spend ?? 0), pv: Number(s._sum.purchaseValue ?? 0) }]));

    const topSellers = topSellerStats.map((s) => {
      const rev = Number(s._sum.total ?? 0);
      const adData = spendMap.get(s.sellerId) ?? { spend: 0, pv: 0 };
      return {
        name: sellerNameMap.get(s.sellerId) ?? 'Unknown',
        revenue: rev,
        orders: s._count._all,
        roas: adData.spend > 0 ? adData.pv / adData.spend : 0,
      };
    });

    // Calculate avg ROAS from ad stats
    const totalAdAgg = await this.prisma.adStatsDaily.aggregate({ _sum: { spend: true, purchaseValue: true } });
    const adSpend = Number(totalAdAgg._sum?.spend ?? 0);
    const adRevenue = Number(totalAdAgg._sum?.purchaseValue ?? 0);
    const avgRoas = adSpend > 0 ? adRevenue / adSpend : 0;

    // Format revenueByDay — fill missing days with zeros
    const revenueMap = new Map(
      (revenueByDay as Array<{ date: Date; revenue: number; orders: number }>).map((r) => [
        new Date(r.date).toISOString().slice(0, 10),
        r,
      ]),
    );
    const formattedRevenueByDay: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = revenueMap.get(key);
      formattedRevenueByDay.push({
        date: key,
        revenue: entry ? Number(entry.revenue) : 0,
        orders: entry ? Number(entry.orders) : 0,
      });
    }

    return {
      kpis: {
        totalSellers,
        activeSellers,
        pendingApprovals,
        totalProducts,
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.total ?? 0),
        totalUsers,
        avgRoas: Math.round(avgRoas * 100) / 100,
        revenueByDay: formattedRevenueByDay,
        topSellers,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customerName ?? '',
        sellerName: o.seller?.name ?? '',
        sellerId: o.seller?.id ?? '',
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }

  // ─── SELLERS ────────────────────────────────────────────────────────────────

  async listSellers(query: AdminQueryDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [sellers, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          paypalGateway: { select: { type: true } },
          creditCardGateway: { select: { type: true } },
          sellerUsers: {
            where: { role: 'OWNER' },
            take: 1,
            include: { user: { select: { email: true } } },
          },
          settings: { select: { supportEmail: true } },
          _count: { select: { orders: true, sellpages: true, domains: true } },
        },
      }),
      this.prisma.seller.count({ where }),
    ]);

    // Enrich with revenue + ROAS aggregates
    const sellerIds = sellers.map((s) => s.id);
    const [revenueAgg, spendAgg] = await Promise.all([
      sellerIds.length > 0
        ? this.prisma.order.groupBy({
            by: ['sellerId'],
            where: { sellerId: { in: sellerIds } },
            _sum: { total: true },
          })
        : [],
      sellerIds.length > 0
        ? this.prisma.adStatsDaily.groupBy({
            by: ['sellerId'],
            where: { sellerId: { in: sellerIds } },
            _sum: { spend: true, purchaseValue: true },
          })
        : [],
    ]);

    const revenueMap = new Map((revenueAgg as any[]).map((r: any) => [r.sellerId, Number(r._sum.total ?? 0)]));
    const adSpendMap = new Map((spendAgg as any[]).map((r: any) => [r.sellerId, { spend: Number(r._sum.spend ?? 0), pv: Number(r._sum.purchaseValue ?? 0) }]));

    const data = sellers.map((s) => {
      const rev = revenueMap.get(s.id) ?? 0;
      const adData = adSpendMap.get(s.id) ?? { spend: 0, pv: 0 };
      return {
        id: s.id,
        name: s.name,
        email: s.sellerUsers[0]?.user?.email ?? '',
        phone: null,
        status: s.status,
        paypalGateway: s.paypalGateway?.type ?? null,
        creditCardGateway: s.creditCardGateway?.type ?? null,
        stores: s._count.domains,
        products: s._count.sellpages,
        orders: s._count.orders,
        revenue: rev,
        roas: adData.spend > 0 ? adData.pv / adData.spend : 0,
        createdAt: s.createdAt,
      };
    });

    return { data, total, page, limit };
  }

  async getSellerDetail(id: string): Promise<any> {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      include: {
        settings: true,
        domains: true,
        paypalGateway: true,
        creditCardGateway: true,
        sellerUsers: {
          include: { user: { select: { id: true, email: true, displayName: true, role: true } } },
        },
        _count: {
          select: {
            orders: true,
            sellpages: true,
            campaigns: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException(`Seller ${id} not found`);
    }

    return seller;
  }

  async createSeller(dto: CreateSellerDto): Promise<any> {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const slug = this.generateSlug(dto.name);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          displayName: dto.name,
          role: 'SELLER',
        },
      });

      const seller = await tx.seller.create({
        data: {
          name: dto.name,
          slug,
        },
      });

      await tx.sellerUser.create({
        data: {
          sellerId: seller.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      await tx.sellerSettings.create({
        data: { sellerId: seller.id },
      });

      return { user, seller };
    });

    return result;
  }

  async updateSeller(id: string, dto: UpdateSellerDto): Promise<any> {
    const seller = await this.prisma.seller.findUnique({ where: { id } });
    if (!seller) {
      throw new NotFoundException(`Seller ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.paypalGatewayId !== undefined) data.paypalGatewayId = dto.paypalGatewayId || null;
    if (dto.creditCardGatewayId !== undefined) data.creditCardGatewayId = dto.creditCardGatewayId || null;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl || null;
    if (dto.faviconUrl !== undefined) data.faviconUrl = dto.faviconUrl || null;

    return this.prisma.seller.update({
      where: { id },
      data,
    });
  }

  async resetSellerPassword(sellerId: string, newPassword: string): Promise<any> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { sellerUsers: { include: { user: true } } },
    });
    if (!seller) {
      throw new NotFoundException(`Seller ${sellerId} not found`);
    }
    if (!seller.sellerUsers.length) {
      throw new NotFoundException(`No user account linked to seller ${sellerId}`);
    }

    const userId = seller.sellerUsers[0].userId;
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    return { success: true, message: 'Password reset successfully' };
  }

  // ─── ORDERS ─────────────────────────────────────────────────────────────────

  async listOrders(query: AdminQueryDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          customerName: true,
          total: true,
          currency: true,
          status: true,
          trackingNumber: true,
          transactionId: true,
          paymentMethod: true,
          createdAt: true,
          seller: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const data = orders.map((o) => {
      const maxQty = o.items.reduce((max, i) => Math.max(max, i.quantity), 0);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        sellerName: o.seller?.name ?? '',
        sellerId: o.seller?.id ?? '',
        customer: o.customerName ?? o.customerEmail ?? '',
        product: o.items.map((i) => i.productName).join(', ') || 'N/A',
        total: Number(o.total),
        status: o.status,
        trackingNumber: o.trackingNumber,
        transactionId: o.transactionId,
        createdAt: o.createdAt,
        hasHighQty: maxQty > 5,
        maxQty,
      };
    });

    return { data, total, page, limit };
  }

  async getOrderDetail(id: string): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, slug: true } },
        sellpage: { select: { id: true, slug: true, titleOverride: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  // ─── PRODUCTS ───────────────────────────────────────────────────────────────

  async listProducts(query: AdminQueryDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { productCode: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
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
          compareAtPrice: true,
          costPrice: true,
          currency: true,
          sku: true,
          status: true,
          tags: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          pricingRules: {
            where: { isActive: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            select: {
              id: true,
              suggestedRetail: true,
              sellerTakePercent: true,
              sellerTakeFixed: true,
            },
          },
          _count: { select: { variants: true, sellpages: true, orderItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getProductDetail(id: string): Promise<any> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { position: 'asc' } },
        labels: { include: { label: true } },
        pricingRules: { orderBy: { effectiveFrom: 'desc' } },
        assetMedia: {
          where: { mediaType: 'VIDEO' },
          orderBy: { position: 'asc' },
        },
        _count: { select: { sellpages: true, orderItems: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async createProduct(dto: CreateProductDto): Promise<any> {
    const slug = this.generateSlug(dto.name);
    const productCode = dto.productCode ?? this.generateProductCode();

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        productCode,
        basePrice: dto.price,
        compareAtPrice: dto.compareAtPrice,
        costPrice: dto.costPrice,
        sku: dto.sku,
        description: dto.description,
        tags: dto.tags ?? [],
        status: (dto.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED') ?? 'DRAFT',
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<any> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.basePrice = dto.price;
    if (dto.compareAtPrice !== undefined) data.compareAtPrice = dto.compareAtPrice;
    if (dto.costPrice !== undefined) data.costPrice = dto.costPrice;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.images !== undefined) data.images = dto.images;
    if (dto.optionDefinitions !== undefined) data.optionDefinitions = dto.optionDefinitions;
    if (dto.quantityCosts !== undefined) data.quantityCosts = dto.quantityCosts;
    if (dto.allowOutOfStockPurchase !== undefined) data.allowOutOfStockPurchase = dto.allowOutOfStockPurchase;

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  // ─── PRODUCT UPLOAD ────────────────────────────────────────────────────────

  async getProductUploadUrl(filename: string, contentType: string) {
    const key = this.r2.buildPlatformKey(filename);
    return this.r2.getSignedUploadUrl(key, contentType);
  }

  // ─── VARIANTS ─────────────────────────────────────────────────────────────

  async createVariant(productId: string, dto: CreateVariantDto): Promise<any> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const maxPos = await this.prisma.productVariant.aggregate({
      where: { productId },
      _max: { position: true },
    });

    return this.prisma.productVariant.create({
      data: {
        productId,
        name: dto.name,
        sku: dto.sku,
        priceOverride: dto.priceOverride,
        compareAtPrice: dto.compareAtPrice,
        costPrice: dto.costPrice,
        fulfillmentCost: dto.fulfillmentCost,
        image: dto.image,
        options: (dto.options ?? {}) as any,
        stockQuantity: dto.stockQuantity ?? 0,
        isActive: dto.isActive ?? true,
        position: dto.position ?? (maxPos._max.position ?? 0) + 1,
      },
    });
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto): Promise<any> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.priceOverride !== undefined) data.priceOverride = dto.priceOverride;
    if (dto.compareAtPrice !== undefined) data.compareAtPrice = dto.compareAtPrice;
    if (dto.costPrice !== undefined) data.costPrice = dto.costPrice;
    if (dto.fulfillmentCost !== undefined) data.fulfillmentCost = dto.fulfillmentCost;
    if (dto.image !== undefined) data.image = dto.image;
    if (dto.options !== undefined) data.options = dto.options as any;
    if (dto.stockQuantity !== undefined) data.stockQuantity = dto.stockQuantity;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.position !== undefined) data.position = dto.position;

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data,
    });
  }

  async deleteVariant(productId: string, variantId: string): Promise<any> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

    return this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  async generateVariants(productId: string): Promise<any> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const optionDefs = (product.optionDefinitions as any[]) ?? [];
    if (optionDefs.length === 0) {
      return { created: 0, variants: [] };
    }

    // Build all combinations using cartesian product
    const allValues: Array<{ name: string; values: string[] }> = optionDefs.map((o: any) => ({
      name: o.name,
      values: o.values ?? [],
    }));

    const combinations = this.cartesianProduct(allValues);

    // Get existing variant option combos to avoid duplicates
    const existing = await this.prisma.productVariant.findMany({
      where: { productId },
      select: { options: true },
    });
    const existingKeys = new Set(
      existing.map((v) => JSON.stringify(v.options)),
    );

    const maxPos = await this.prisma.productVariant.aggregate({
      where: { productId },
      _max: { position: true },
    });
    let pos = (maxPos._max.position ?? 0) + 1;

    const toCreate = combinations.filter(
      (combo) => !existingKeys.has(JSON.stringify(combo)),
    );

    const created = await Promise.all(
      toCreate.map((combo) => {
        const name = Object.values(combo).join(' / ');
        return this.prisma.productVariant.create({
          data: {
            productId,
            name,
            options: combo as any,
            position: pos++,
            isActive: true,
            stockQuantity: 0,
          },
        });
      }),
    );

    return { created: created.length, variants: created };
  }

  async bulkUpdateVariants(productId: string, dto: BulkUpdateVariantsDto): Promise<any> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const results = await Promise.all(
      dto.variants.map((v) => {
        const data: Record<string, unknown> = {};
        if (v.name !== undefined) data.name = v.name;
        if (v.sku !== undefined) data.sku = v.sku;
        if (v.priceOverride !== undefined) data.priceOverride = v.priceOverride;
        if (v.compareAtPrice !== undefined) data.compareAtPrice = v.compareAtPrice;
        if (v.costPrice !== undefined) data.costPrice = v.costPrice;
        if (v.fulfillmentCost !== undefined) data.fulfillmentCost = v.fulfillmentCost;
        if (v.image !== undefined) data.image = v.image;
        if (v.options !== undefined) data.options = v.options as any;
        if (v.stockQuantity !== undefined) data.stockQuantity = v.stockQuantity;
        if (v.isActive !== undefined) data.isActive = v.isActive;
        if (v.position !== undefined) data.position = v.position;

        return this.prisma.productVariant.updateMany({
          where: { id: v.id, productId },
          data,
        });
      }),
    );

    return { updated: results.length };
  }

  // ─── LABELS ───────────────────────────────────────────────────────────────

  async listLabels(): Promise<any> {
    return this.prisma.productLabel.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async createLabel(name: string): Promise<any> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const existing = await this.prisma.productLabel.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Label "${name}" already exists`);

    return this.prisma.productLabel.create({ data: { name, slug } });
  }

  async syncProductLabels(productId: string, labelIds: string[]): Promise<any> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    // Delete all existing and re-create
    await this.prisma.productProductLabel.deleteMany({ where: { productId } });

    if (labelIds.length > 0) {
      await this.prisma.productProductLabel.createMany({
        data: labelIds.map((labelId) => ({ productId, labelId })),
      });
    }

    return { synced: labelIds.length };
  }

  // ─── PRICING RULES ───────────────────────────────────────────────────────

  async createPricingRule(productId: string, data: any): Promise<any> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    return this.prisma.pricingRule.create({
      data: {
        productId,
        suggestedRetail: data.suggestedRetail,
        sellerTakePercent: data.sellerTakePercent,
        sellerTakeFixed: data.sellerTakeFixed,
        holdPercent: data.holdPercent,
        holdDurationDays: data.holdDurationDays,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveUntil: data.effectiveUntil ? new Date(data.effectiveUntil) : null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updatePricingRule(productId: string, ruleId: string, data: any): Promise<any> {
    const rule = await this.prisma.pricingRule.findFirst({
      where: { id: ruleId, productId },
    });
    if (!rule) throw new NotFoundException(`Pricing rule ${ruleId} not found`);

    const update: Record<string, unknown> = {};
    if (data.suggestedRetail !== undefined) update.suggestedRetail = data.suggestedRetail;
    if (data.sellerTakePercent !== undefined) update.sellerTakePercent = data.sellerTakePercent;
    if (data.sellerTakeFixed !== undefined) update.sellerTakeFixed = data.sellerTakeFixed;
    if (data.holdPercent !== undefined) update.holdPercent = data.holdPercent;
    if (data.holdDurationDays !== undefined) update.holdDurationDays = data.holdDurationDays;
    if (data.effectiveFrom !== undefined) update.effectiveFrom = new Date(data.effectiveFrom);
    if (data.effectiveUntil !== undefined) update.effectiveUntil = data.effectiveUntil ? new Date(data.effectiveUntil) : null;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    return this.prisma.pricingRule.update({ where: { id: ruleId }, data: update });
  }

  async deletePricingRule(productId: string, ruleId: string): Promise<any> {
    const rule = await this.prisma.pricingRule.findFirst({
      where: { id: ruleId, productId },
    });
    if (!rule) throw new NotFoundException(`Pricing rule ${ruleId} not found`);

    return this.prisma.pricingRule.delete({ where: { id: ruleId } });
  }

  // ─── STORES (SELLER DOMAINS) ───────────────────────────────────────────────

  async listStores(query: AdminQueryDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.hostname = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.sellerDomain.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          hostname: true,
          verificationMethod: true,
          verificationToken: true,
          status: true,
          isPrimary: true,
          verifiedAt: true,
          failureReason: true,
          createdAt: true,
          seller: { select: { id: true, name: true, slug: true } },
          _count: { select: { sellpages: true } },
        },
      }),
      this.prisma.sellerDomain.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getStoreDetail(id: string): Promise<any> {
    const store = await this.prisma.sellerDomain.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, slug: true, logoUrl: true, faviconUrl: true } },
        sellpages: {
          select: { id: true, slug: true, status: true, titleOverride: true },
        },
      },
    });

    if (!store) {
      throw new NotFoundException(`Store (domain) ${id} not found`);
    }

    return store;
  }

  async createStore(dto: CreateStoreDto): Promise<any> {
    const seller = await this.prisma.seller.findUnique({ where: { id: dto.sellerId } });
    if (!seller) {
      throw new NotFoundException(`Seller ${dto.sellerId} not found`);
    }

    const existingDomain = await this.prisma.sellerDomain.findFirst({
      where: { hostname: dto.hostname },
    });
    if (existingDomain) {
      throw new ConflictException(`Hostname "${dto.hostname}" is already registered`);
    }

    const verificationToken = `pixecom-verify-${this.generateRandomToken()}`;

    return this.prisma.sellerDomain.create({
      data: {
        sellerId: dto.sellerId,
        hostname: dto.hostname,
        verificationMethod: (dto.verificationMethod as 'TXT' | 'A_RECORD') ?? 'TXT',
        verificationToken,
      },
    });
  }

  async updateStore(id: string, body: Record<string, unknown>): Promise<any> {
    const store = await this.prisma.sellerDomain.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundException(`Store (domain) ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.isPrimary !== undefined) data.isPrimary = body.isPrimary;
    if (body.verificationMethod !== undefined) data.verificationMethod = body.verificationMethod;

    return this.prisma.sellerDomain.update({
      where: { id },
      data,
    });
  }

  async verifyStore(id: string): Promise<any> {
    const domain = await this.prisma.sellerDomain.findUnique({ where: { id } });
    if (!domain) {
      throw new NotFoundException(`Store domain ${id} not found`);
    }
    return this.prisma.sellerDomain.update({
      where: { id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
  }

  // ─── ANALYTICS ──────────────────────────────────────────────────────────────

  async getAnalytics(from?: string, to?: string): Promise<any> {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const dateFrom = from ? new Date(from) : defaultFrom;
    const dateTo = to ? new Date(to) : now;

    // byDate: daily breakdown from sellpage stats + order stats
    const byDate = await this.prisma.$queryRaw`
      SELECT
        DATE(stat_date) as date,
        COALESCE(SUM(revenue), 0)::float as revenue,
        COALESCE(SUM(orders_count), 0)::int as orders,
        COALESCE(SUM(ad_spend), 0)::float as spend,
        0::float as "productCost",
        0::float as "paymentFee",
        COALESCE(SUM(revenue), 0)::float - COALESCE(SUM(ad_spend), 0)::float as profit,
        CASE WHEN SUM(ad_spend) > 0 THEN (SUM(revenue) / SUM(ad_spend))::float ELSE 0 END as roas
      FROM sellpage_stats_daily
      WHERE stat_date >= ${dateFrom} AND stat_date <= ${dateTo}
      GROUP BY DATE(stat_date)
      ORDER BY date ASC
    ` as any[];

    // bySeller: aggregated by seller
    const sellerStats = await this.prisma.order.groupBy({
      by: ['sellerId'],
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });

    const sellerIds = sellerStats.map((s) => s.sellerId);
    const [sellerNames, sellerSpends] = await Promise.all([
      sellerIds.length > 0
        ? this.prisma.seller.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, name: true },
          })
        : [],
      sellerIds.length > 0
        ? this.prisma.adStatsDaily.groupBy({
            by: ['sellerId'],
            where: { sellerId: { in: sellerIds }, statDate: { gte: dateFrom, lte: dateTo } },
            _sum: { spend: true },
          })
        : [],
    ]);
    const nameMap = new Map(sellerNames.map((s) => [s.id, s.name]));
    const sellerSpendMap = new Map((sellerSpends as any[]).map((s: any) => [s.sellerId, Number(s._sum.spend ?? 0)]));

    const bySeller = sellerStats.map((s) => {
      const rev = Number(s._sum.total ?? 0);
      const spend = sellerSpendMap.get(s.sellerId) ?? 0;
      return {
        name: nameMap.get(s.sellerId) ?? 'Unknown',
        revenue: rev,
        orders: s._count._all,
        spend,
        roas: spend > 0 ? rev / spend : 0,
      };
    });

    // byProduct: from order items
    const byProduct = await this.prisma.$queryRaw`
      SELECT
        p.name,
        COUNT(DISTINCT oi.order_id)::int as orders,
        COALESCE(SUM(oi.line_total), 0)::float as revenue,
        0::float as cr
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${dateFrom} AND o.created_at <= ${dateTo}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    ` as any[];

    // byDomain: from sellpage stats + domain info
    const byDomain = await this.prisma.$queryRaw`
      SELECT
        COALESCE(sd.hostname, 'no-domain') as domain,
        COALESCE(SUM(sps.revenue), 0)::float as revenue,
        COALESCE(SUM(sps.orders_count), 0)::int as orders,
        CASE WHEN SUM(sps.content_views) > 0
          THEN (SUM(sps.purchases)::float / SUM(sps.content_views)::float * 100)
          ELSE 0 END as cr
      FROM sellpage_stats_daily sps
      JOIN sellpages sp ON sps.sellpage_id = sp.id
      LEFT JOIN seller_domains sd ON sp.domain_id = sd.id
      WHERE sps.stat_date >= ${dateFrom} AND sps.stat_date <= ${dateTo}
      GROUP BY sd.hostname
      ORDER BY revenue DESC
      LIMIT 10
    ` as any[];

    // Format byDate with string dates
    const formattedByDate = (byDate as any[]).map((d: any) => ({
      date: new Date(d.date).toISOString().slice(0, 10),
      revenue: Number(d.revenue),
      orders: Number(d.orders),
      spend: Number(d.spend),
      productCost: 0,
      paymentFee: 0,
      profit: Number(d.profit),
      roas: Number(d.roas) || 0,
    }));

    return { byDate: formattedByDate, bySeller, byProduct, byDomain };
  }

  // ─── SETTINGS: PLATFORM ─────────────────────────────────────────────────────

  async getPlatformSettings(): Promise<any> {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data: {} });
    }
    return settings;
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto): Promise<any> {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.platformSettings.create({ data: {} });
    }

    const data: Record<string, unknown> = {};
    if (dto.platformName !== undefined) data.platformName = dto.platformName;
    if (dto.defaultCurrency !== undefined) data.defaultCurrency = dto.defaultCurrency;
    if (dto.defaultTimezone !== undefined) data.defaultTimezone = dto.defaultTimezone;
    if (dto.defaultLanguage !== undefined) data.defaultLanguage = dto.defaultLanguage;
    if (dto.supportEmail !== undefined) data.supportEmail = dto.supportEmail;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.smtpConfig !== undefined) data.smtpConfig = dto.smtpConfig;
    if (dto.smsConfig !== undefined) data.smsConfig = dto.smsConfig;
    if (dto.legalPages !== undefined) data.legalPages = dto.legalPages;
    if (dto.billingConfig !== undefined) data.billingConfig = dto.billingConfig;

    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data,
    });
  }

  // ─── SETTINGS: PAYMENT GATEWAYS ────────────────────────────────────────────

  private maskCredentials(creds: Record<string, unknown>): Record<string, string> {
    const masked: Record<string, string> = {};
    for (const [key, val] of Object.entries(creds)) {
      if (typeof val === 'string' && val.length > 4) {
        masked[key] = '••••' + val.slice(-4);
      } else if (typeof val === 'string') {
        masked[key] = '••••';
      }
    }
    return masked;
  }

  async listPaymentGateways(): Promise<any> {
    const gateways = await this.prisma.paymentGateway.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sellersPaypal: true, sellersCreditCard: true } },
      },
    });
    return gateways.map((gw) => ({
      ...gw,
      credentials: this.maskCredentials((gw.credentials as Record<string, unknown>) ?? {}),
      _count: {
        sellers: (gw._count.sellersPaypal ?? 0) + (gw._count.sellersCreditCard ?? 0),
      },
    }));
  }

  async createPaymentGateway(dto: CreatePaymentGatewayDto): Promise<any> {
    return this.prisma.paymentGateway.create({
      data: {
        name: dto.name,
        type: dto.type,
        status: dto.status ?? 'ACTIVE',
        environment: dto.environment ?? 'sandbox',
        credentials: (dto.credentials ?? {}) as any,
      },
    });
  }

  async updatePaymentGateway(id: string, body: Record<string, unknown>): Promise<any> {
    const gateway = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gateway) {
      throw new NotFoundException(`Payment gateway ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.status !== undefined) data.status = body.status;
    if (body.environment !== undefined) data.environment = body.environment;
    if (body.credentials !== undefined) data.credentials = body.credentials;

    return this.prisma.paymentGateway.update({
      where: { id },
      data,
    });
  }

  async deletePaymentGateway(id: string): Promise<any> {
    const gateway = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gateway) {
      throw new NotFoundException(`Payment gateway ${id} not found`);
    }

    return this.prisma.paymentGateway.delete({ where: { id } });
  }

  // ─── SETTINGS: DISCOUNTS ───────────────────────────────────────────────────

  async listDiscounts(): Promise<any> {
    return this.prisma.discount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sellpage: { select: { id: true, slug: true, titleOverride: true } },
      },
    });
  }

  async createDiscount(dto: CreateDiscountDto): Promise<any> {
    const existing = await this.prisma.discount.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Discount code "${dto.code}" already exists`);
    }

    return this.prisma.discount.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        usageLimit: dto.usageLimit,
        sellpageId: dto.sellpageId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async updateDiscount(id: string, body: Record<string, unknown>): Promise<any> {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      throw new NotFoundException(`Discount ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (body.code !== undefined) data.code = (body.code as string).toUpperCase();
    if (body.type !== undefined) data.type = body.type;
    if (body.value !== undefined) data.value = body.value;
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit;
    if (body.status !== undefined) data.status = body.status;
    if (body.sellpageId !== undefined) data.sellpageId = body.sellpageId;
    if (body.expiresAt !== undefined) data.expiresAt = new Date(body.expiresAt as string);

    return this.prisma.discount.update({
      where: { id },
      data,
    });
  }

  async deleteDiscount(id: string): Promise<any> {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) {
      throw new NotFoundException(`Discount ${id} not found`);
    }

    return this.prisma.discount.delete({ where: { id } });
  }

  // ─── SETTINGS: ADMIN USERS ─────────────────────────────────────────────────

  async listAdminUsers(): Promise<any> {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { isSuperadmin: true },
          { role: { in: ['SUPERADMIN', 'SUPPORT', 'FINANCE', 'CONTENT'] } },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isSuperadmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdminUser(dto: CreateAdminUserDto): Promise<any> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.name,
        role: dto.role as 'SUPERADMIN' | 'SUPPORT' | 'FINANCE' | 'CONTENT',
        isSuperadmin: dto.role === 'SUPERADMIN',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isSuperadmin: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateAdminUser(id: string, body: Record<string, unknown>): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const data: Record<string, unknown> = {};
    if (body.displayName !== undefined) data.displayName = body.displayName;
    if (body.role !== undefined) {
      data.role = body.role;
      data.isSuperadmin = body.role === 'SUPERADMIN';
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password !== undefined) {
      data.passwordHash = await bcrypt.hash(body.password as string, BCRYPT_COST);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isSuperadmin: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  // ─── CONTENT PERFORMANCE ───────────────────────────────────────────────────

  async getContentPerformance(from?: string, to?: string): Promise<any> {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const statDateFilter = Object.keys(dateFilter).length > 0 ? { statDate: dateFilter } : {};

    const [sellpageStats, creativeCount, activeCampaigns] = await Promise.all([
      this.prisma.sellpageStatsDaily.groupBy({
        by: ['sellpageId'],
        where: statDateFilter,
        _sum: {
          revenue: true,
          ordersCount: true,
          adSpend: true,
          contentViews: true,
          purchases: true,
        },
        orderBy: { _sum: { revenue: 'desc' } },
        take: 20,
      }),
      this.prisma.creative.count(),
      this.prisma.campaign.count({ where: { status: 'ACTIVE' } }),
    ]);

    // Fetch sellpage details for the grouped results
    const sellpageIds = sellpageStats.map((s) => s.sellpageId);
    const sellpages = await this.prisma.sellpage.findMany({
      where: { id: { in: sellpageIds } },
      select: {
        id: true,
        slug: true,
        titleOverride: true,
        seller: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });

    const sellpageMap = new Map(sellpages.map((s) => [s.id, s]));

    const topSellpages = sellpageStats.map((stat) => ({
      sellpage: sellpageMap.get(stat.sellpageId) ?? null,
      stats: stat._sum,
    }));

    return {
      topSellpages,
      creativeCount,
      activeCampaigns,
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  private generateProductCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PRD-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private generateRandomToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private cartesianProduct(
    options: Array<{ name: string; values: string[] }>,
  ): Array<Record<string, string>> {
    if (options.length === 0) return [{}];

    const [first, ...rest] = options;
    const restCombos = this.cartesianProduct(rest);

    const result: Array<Record<string, string>> = [];
    for (const value of first.values) {
      for (const combo of restCombos) {
        result.push({ [first.name]: value, ...combo });
      }
    }
    return result;
  }
}
