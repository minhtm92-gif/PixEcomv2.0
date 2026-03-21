import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Get approved reviews for a product
  // ─────────────────────────────────────────────────────────────────────────

  async getProductReviews(productId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        body: true,
        images: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return reviews.map((r) => ({
      id: r.id,
      author: r.authorName,
      rating: r.rating,
      date: r.createdAt.toISOString().slice(0, 10), // YYYY-MM-DD
      title: r.title,
      body: r.body,
      verified: r.isVerified,
      images: (r.images as string[]) ?? [],
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Submit a review
  // ─────────────────────────────────────────────────────────────────────────

  async submitReview(sellerSlug: string, dto: SubmitReviewDto) {
    // 1. Resolve seller
    const seller = await this.prisma.seller.findUnique({
      where: { slug: sellerSlug },
      select: { id: true, isActive: true, status: true },
    });

    if (!seller || !seller.isActive || seller.status !== 'ACTIVE') {
      throw new NotFoundException('Store not found');
    }

    // 2. Verify product exists and belongs to seller (via sellpage)
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, sellpages: { where: { sellerId: seller.id }, select: { id: true }, take: 1 } },
    });

    if (!product || product.sellpages.length === 0) {
      throw new NotFoundException('Product not found');
    }

    // 3. Check for verified purchase
    let isVerified = false;
    let orderId: string | null = null;

    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: dto.orderId,
          sellerId: seller.id,
          customerEmail: dto.authorEmail,
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          items: { some: { productId: dto.productId } },
        },
        select: { id: true },
      });

      if (order) {
        isVerified = true;
        orderId = order.id;

        // Check if review already exists for this order+product
        const existing = await this.prisma.review.findUnique({
          where: { uq_review_order_product: { orderId: order.id, productId: dto.productId } },
          select: { id: true },
        });

        if (existing) {
          throw new ConflictException('You already submitted a review for this product on this order');
        }
      }
    }

    // 4. Create review (PENDING — requires seller approval)
    const review = await this.prisma.review.create({
      data: {
        sellerId: seller.id,
        productId: dto.productId,
        orderId,
        authorName: dto.authorName,
        authorEmail: dto.authorEmail,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        images: dto.images ?? [],
        isVerified,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    });

    this.logger.log(
      `Review submitted: ${review.id} for product ${dto.productId} by ${dto.authorEmail} (verified=${isVerified})`,
    );

    return { id: review.id, status: review.status, isVerified };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELLER: List reviews for moderation
  // ─────────────────────────────────────────────────────────────────────────

  async listReviewsForSeller(
    sellerId: string,
    filters: { status?: string; productId?: string; page?: number; perPage?: number },
  ): Promise<{ reviews: any[]; total: number; page: number; perPage: number }> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const where: any = { sellerId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.productId) {
      where.productId = filters.productId;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          authorName: true,
          authorEmail: true,
          rating: true,
          title: true,
          body: true,
          images: true,
          isVerified: true,
          status: true,
          createdAt: true,
          product: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        authorEmail: r.authorEmail,
        rating: r.rating,
        title: r.title,
        body: r.body,
        images: r.images,
        isVerified: r.isVerified,
        status: r.status,
        createdAt: r.createdAt,
        productName: r.product.name,
        productSlug: r.product.slug,
      })),
      total,
      page,
      perPage,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELLER: Moderate a review (approve/reject)
  // ─────────────────────────────────────────────────────────────────────────

  async moderateReview(sellerId: string, reviewId: string, action: 'approve' | 'reject') {
    const review = await this.prisma.review.findFirst({
      where: { id: reviewId, sellerId },
      select: { id: true, status: true, productId: true, rating: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // If already in target status, idempotent return
    if (review.status === newStatus) {
      return { id: review.id, status: newStatus };
    }

    const oldStatus = review.status;

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { status: newStatus },
    });

    // Re-aggregate product rating when status changes
    if (
      (oldStatus !== 'APPROVED' && newStatus === 'APPROVED') ||
      (oldStatus === 'APPROVED' && newStatus !== 'APPROVED')
    ) {
      await this.recalculateProductRating(review.productId);
    }

    this.logger.log(`Review ${reviewId} moderated: ${oldStatus} → ${newStatus}`);
    return { id: review.id, status: newStatus };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AGGREGATE: Recalculate product rating + reviewCount
  // ─────────────────────────────────────────────────────────────────────────

  async recalculateProductRating(productId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { id: true },
    });

    const avgRating = Math.round((agg._avg.rating ?? 0) * 10) / 10; // 1 decimal
    const reviewCount = agg._count.id;

    await this.prisma.product.update({
      where: { id: productId },
      data: { rating: avgRating, reviewCount },
    });

    this.logger.log(
      `Product ${productId} rating updated: ${avgRating} (${reviewCount} reviews)`,
    );
  }
}
