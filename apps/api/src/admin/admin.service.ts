import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const BCRYPT_COST = 12;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
          paymentGateway: { select: { type: true } },
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
        paymentGateway: s.paymentGateway?.type ?? null,
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
        paymentGateway: true,
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
    if (dto.paymentGatewayId !== undefined) data.paymentGatewayId = dto.paymentGatewayId;

    return this.prisma.seller.update({
      where: { id },
      data,
    });
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

    const data = orders.map((o) => ({
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
    }));

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
          createdAt: true,
          updatedAt: true,
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
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.tags !== undefined) data.tags = dto.tags;

    return this.prisma.product.update({
      where: { id },
      data,
    });
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
        seller: { select: { id: true, name: true, slug: true } },
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

  async listPaymentGateways(): Promise<any> {
    return this.prisma.paymentGateway.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sellers: true } },
      },
    });
  }

  async createPaymentGateway(dto: CreatePaymentGatewayDto): Promise<any> {
    return this.prisma.paymentGateway.create({
      data: {
        name: dto.name,
        type: dto.type,
        status: dto.status ?? 'ACTIVE',
        environment: dto.environment ?? 'sandbox',
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
}
