import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { TrackingRateLimitGuard } from './guards/tracking-rate-limit.guard';
import { ListOrdersQueryDto } from './dto/list-orders.dto';
import { OrdersService } from './orders.service';
import { OrdersTrackingService } from './orders-tracking.service';

/**
 * Orders — seller-scoped view + tracking refresh.
 *
 * Phase 2.3.4-D: list + detail (read-only).
 * Phase 2.3.6: adds POST /:id/refresh-tracking with rate limiting.
 *
 * All routes require JWT. sellerId sourced from JWT (never from body/params).
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly trackingService: OrdersTrackingService,
  ) {}

  /**
   * GET /api/orders
   * Paginated order list for the authenticated seller.
   *
   * Query params:
   *   dateFrom     — YYYY-MM-DD (default today UTC)
   *   dateTo       — YYYY-MM-DD (default today UTC)
   *   sellpageId   — optional UUID filter
   *   status       — optional status filter
   *   search       — optional order number prefix / email contains
   *   limit        — 1–100 (default 20)
   *   cursor       — opaque keyset cursor from previous nextCursor
   */
  @Get()
  listOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.service.listOrders(user.sellerId, query);
  }

  /**
   * GET /api/orders/:id
   * Full order detail including items, event history, and tracking info.
   * Returns 404 if order not found or belongs to a different seller.
   */
  @Get(':id')
  getOrder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOrder(user.sellerId, id);
  }

  /**
   * POST /api/orders/:id/refresh-tracking
   * Calls 17track to refresh tracking status for the order.
   *
   * Rate limited: 5 requests per 60 seconds per seller.
   * Returns 400 if order has no tracking number.
   * Returns 404 if order not found or belongs to a different seller.
   * Returns 429 when rate limit exceeded.
   */
  @Post(':id/refresh-tracking')
  @HttpCode(200)
  @UseGuards(TrackingRateLimitGuard)
  refreshTracking(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trackingService.refreshTracking(user.sellerId, id);
  }
}
