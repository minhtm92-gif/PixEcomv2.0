import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { ListOrdersQueryDto } from './dto/list-orders.dto';
import { OrdersService } from './orders.service';

/**
 * Orders — read-only seller-scoped view.
 *
 * Phase 2.3.4-D: list + detail only. No mutation endpoints.
 * All routes require JWT. sellerId sourced from JWT (never from body/params).
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

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
   * Full order detail including items and event history.
   * Returns 404 if order not found or belongs to a different seller.
   */
  @Get(':id')
  getOrder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOrder(user.sellerId, id);
  }
}
