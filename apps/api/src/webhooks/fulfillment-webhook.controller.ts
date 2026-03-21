import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WebhookOutboundService } from '../webhook-outbound/webhook-outbound.service';

interface FulfillmentStatusPayload {
  orderId: string;
  orderNumber: string;
  fulfillmentStatus: string; // PICKING | PACKING | READY_TO_SHIP | SHIPPED | DELIVERED
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  timestamp: string;
}

@Controller('webhooks/fulfillment')
export class FulfillmentWebhookController {
  private readonly logger = new Logger(FulfillmentWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post('status-update')
  @HttpCode(200)
  async handleStatusUpdate(
    @Body() body: FulfillmentStatusPayload,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
  ) {
    // 1. Verify signature
    const secret = this.config.get<string>('FULFILLMENT_WEBHOOK_SECRET', 'dev-webhook-secret-pixful');
    const rawBody = JSON.stringify(body);
    const isValid = WebhookOutboundService.verifySignature(
      rawBody,
      signature ?? '',
      timestamp ?? '',
      secret,
    );

    if (!isValid) {
      this.logger.warn('Fulfillment webhook: Invalid signature');
      return { received: true, error: 'Invalid signature' };
    }

    // 2. Find order by ID or orderNumber
    const order = await this.prisma.order.findFirst({
      where: body.orderId
        ? { id: body.orderId }
        : { orderNumber: body.orderNumber },
      select: { id: true, sellerId: true, status: true },
    });

    if (!order) {
      this.logger.warn(
        `Fulfillment webhook: Order not found - ${body.orderId || body.orderNumber}`,
      );
      return { received: true, error: 'Order not found' };
    }

    // 3. Map fulfillment status to PixEcom order updates
    const updateData: Record<string, unknown> = {};

    if (body.trackingNumber) {
      updateData.trackingNumber = body.trackingNumber;
    }
    if (body.trackingUrl) {
      updateData.trackingUrl = body.trackingUrl;
    }

    // Map fulfillment status to PixEcom order status
    const statusMap: Record<string, string> = {
      SHIPPED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
    };

    const newStatus = statusMap[body.fulfillmentStatus];
    if (newStatus && newStatus !== order.status) {
      updateData.status = newStatus;
    }

    // 4. Update order if there are changes
    if (Object.keys(updateData).length > 0) {
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: order.id },
          data: updateData as any,
        }),
        // Create event if status changed
        ...(newStatus && newStatus !== order.status
          ? [
              this.prisma.orderEvent.create({
                data: {
                  orderId: order.id,
                  sellerId: order.sellerId,
                  eventType: newStatus as any,
                  description: `Fulfillment status: ${body.fulfillmentStatus}${body.carrierName ? ` via ${body.carrierName}` : ''}${body.trackingNumber ? ` — Tracking: ${body.trackingNumber}` : ''}`,
                },
              }),
            ]
          : []),
      ]);

      this.logger.log(
        `Fulfillment webhook: Order ${body.orderNumber} updated — ${JSON.stringify(updateData)}`,
      );
    }

    return { received: true, orderId: order.id };
  }
}
