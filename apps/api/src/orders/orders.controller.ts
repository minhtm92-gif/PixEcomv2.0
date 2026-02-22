import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ListOrdersQueryDto } from './dto/list-orders.dto';
import { OrdersBulkService } from './orders-bulk.service';
import { OrdersExportService } from './orders-export.service';
import { OrdersImportService } from './orders-import.service';
import { OrdersService } from './orders.service';

/**
 * Orders — seller-scoped view.
 *
 * Route declaration order matters in NestJS:
 * Static segments (/export, /import-tracking, /bulk-status) MUST be declared
 * before the parameterized route (/:id) to avoid param matching.
 *
 * All routes require JWT. sellerId sourced from JWT (never from body/params).
 */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly service: OrdersService,
    private readonly exportService: OrdersExportService,
    private readonly importService: OrdersImportService,
    private readonly bulkService: OrdersBulkService,
  ) {}

  // ─── Static routes (must come before /:id) ─────────────────────────────────

  /**
   * GET /api/orders/export
   * Download orders as CSV (UTF-8 BOM, Excel-compatible).
   * One row per OrderItem. Max 5000 rows. Rate limited 1 req/30s per seller.
   *
   * Query params: dateFrom, dateTo, status, source (same as list endpoint)
   */
  @Get('export')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query() query: ListOrdersQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.exportService.exportCsv(user.sellerId, query);
    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * POST /api/orders/import-tracking
   * Upload a CSV file to bulk-update tracking numbers.
   * Required CSV columns: OrderNumber, TrackingNumber
   * Optional column: TrackingUrl
   * Max file size: 2 MB.
   */
  @Post('import-tracking')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB hard limit via multer
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'text/csv' ||
          file.originalname.toLowerCase().endsWith('.csv')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are accepted'), false);
        }
      },
    }),
  )
  importTracking(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.importService.importTracking(user.sellerId, file.buffer);
  }

  /**
   * PATCH /api/orders/bulk-status
   * Bulk update order status + log OrderEvent per order.
   * Body: { orderIds: string[], status: OrderStatus }
   * Max 100 orders per call.
   */
  @Patch('bulk-status')
  @HttpCode(200)
  bulkStatus(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkStatusDto,
  ) {
    return this.bulkService.bulkUpdateStatus(user.sellerId, dto);
  }

  // ─── Parameterized routes ───────────────────────────────────────────────────

  /**
   * GET /api/orders
   * Paginated order list for the authenticated seller.
   *
   * Query params:
   *   dateFrom     — YYYY-MM-DD (default today UTC)
   *   dateTo       — YYYY-MM-DD (default today UTC)
   *   sellpageId   — optional UUID filter
   *   status       — optional status filter
   *   source       — optional source filter
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

  /**
   * GET /api/orders/:id/transitions
   * C.3 — Return current status and valid next transitions.
   */
  @Get(':id/transitions')
  @HttpCode(200)
  getOrderTransitions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOrderTransitions(user.sellerId, id);
  }

  /**
   * PATCH /api/orders/:id/status
   * C.1 — Manual single order status change with transition validation.
   * Body: { status: OrderStatus, note?: string }
   */
  @Patch(':id/status')
  @HttpCode(200)
  updateOrderStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.service.updateOrderStatus(user.sellerId, id, dto);
  }
}
