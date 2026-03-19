import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StorefrontService } from './storefront.service';
import { ReviewsService } from './reviews.service';
import { CheckoutDto, ConfirmPaymentDto } from './dto/checkout.dto';
import { SubmitReviewDto } from './dto/review.dto';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly storefront: StorefrontService,
    private readonly reviews: ReviewsService,
  ) {}

  /**
   * GET /api/storefront/resolve-domain?hostname=jal2.com
   * Public — resolves a custom domain hostname to its seller slug.
   * Used by Next.js middleware for custom domain routing.
   * NOTE: must be registered BEFORE :sellerSlug to avoid route collision.
   */
  @Get('resolve-domain')
  resolveDomain(@Query('hostname') hostname: string) {
    return this.storefront.resolveDomain(hostname);
  }

  /**
   * GET /api/storefront/sitemap-data
   * Public — lightweight list of all active sellers + published sellpages for sitemap.xml.
   * NOTE: must be registered BEFORE :sellerSlug to avoid route collision.
   */
  @Get('sitemap-data')
  getSitemapData() {
    return this.storefront.getSitemapData();
  }

  /**
   * GET /api/storefront/:sellerSlug
   * Public — store homepage: seller info + published sellpages with product cards.
   */
  @Get(':sellerSlug')
  getStore(@Param('sellerSlug') sellerSlug: string) {
    return this.storefront.getStore(sellerSlug);
  }

  /**
   * GET /api/storefront/:sellerSlug/track?orderNumber=...&email=...
   * Public — order tracking by orderNumber + email.
   * NOTE: route must come before :sellpageSlug to avoid collision.
   */
  @Get(':sellerSlug/track')
  trackOrder(
    @Param('sellerSlug') sellerSlug: string,
    @Query('orderNumber') orderNumber: string,
    @Query('email') email: string,
  ) {
    return this.storefront.trackOrder(sellerSlug, orderNumber, email);
  }

  /**
   * POST /api/storefront/:sellerSlug/checkout
   * Public — create order + initiate payment.
   */
  @Post(':sellerSlug/checkout')
  checkout(
    @Param('sellerSlug') sellerSlug: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.storefront.checkout(sellerSlug, dto);
  }

  /**
   * POST /api/storefront/:sellerSlug/checkout/:orderId/confirm
   * Public — confirm payment (Stripe verify / PayPal capture).
   */
  @Post(':sellerSlug/checkout/:orderId/confirm')
  confirmPayment(
    @Param('sellerSlug') sellerSlug: string,
    @Param('orderId') orderId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.storefront.confirmPayment(sellerSlug, orderId, dto);
  }

  /**
   * POST /api/storefront/:sellerSlug/reviews
   * Public — submit a product review.
   */
  @Post(':sellerSlug/reviews')
  submitReview(
    @Param('sellerSlug') sellerSlug: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.reviews.submitReview(sellerSlug, dto);
  }

  /**
   * POST /api/storefront/:sellerSlug/event
   * Public — track storefront events (page_view, add_to_cart, etc.).
   */
  @Post(':sellerSlug/event')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  trackEvent(
    @Param('sellerSlug') sellerSlug: string,
    @Body() dto: TrackEventDto,
  ) {
    return this.storefront.trackEvent(sellerSlug, dto);
  }

  /**
   * GET /api/storefront/:sellerSlug/:sellpageSlug
   * Public — sellpage detail with product, variants, images, discounts.
   */
  @Get(':sellerSlug/:sellpageSlug')
  getSellpage(
    @Param('sellerSlug') sellerSlug: string,
    @Param('sellpageSlug') sellpageSlug: string,
  ) {
    return this.storefront.getSellpage(sellerSlug, sellpageSlug);
  }
}
