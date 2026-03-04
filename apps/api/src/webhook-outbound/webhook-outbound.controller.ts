import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('webhook-endpoints')
@UseGuards(JwtAuthGuard)
export class WebhookOutboundController {
  constructor(private readonly prisma: PrismaService) {}

  // ── List endpoints ───────────────────────────────────────────────────────

  @Get()
  async list(@Req() req: any) {
    const sellerId = req.user.sellerId;
    return this.prisma.webhookEndpoint.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { deliveries: true } },
      },
    });
  }

  // ── Create endpoint ──────────────────────────────────────────────────────

  @Post()
  async create(
    @Req() req: any,
    @Body() body: { url: string; description?: string; events: string[] },
  ) {
    const sellerId = req.user.sellerId;
    const secret = crypto.randomBytes(32).toString('hex'); // Auto-generate

    return this.prisma.webhookEndpoint.create({
      data: {
        sellerId,
        url: body.url,
        description: body.description,
        events: body.events,
        secret,
      },
      select: {
        id: true,
        url: true,
        secret: true, // Show secret ONLY on creation
        description: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  // ── Update endpoint ──────────────────────────────────────────────────────

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      url?: string;
      description?: string;
      events?: string[];
      isActive?: boolean;
    },
  ) {
    const sellerId = req.user.sellerId;
    return this.prisma.webhookEndpoint.updateMany({
      where: { id, sellerId },
      data: body,
    });
  }

  // ── Delete endpoint ──────────────────────────────────────────────────────

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const sellerId = req.user.sellerId;
    return this.prisma.webhookEndpoint.deleteMany({
      where: { id, sellerId },
    });
  }

  // ── View delivery log ────────────────────────────────────────────────────

  @Get(':id/deliveries')
  async deliveries(
    @Req() req: any,
    @Param('id') endpointId: string,
    @Query('limit') limit?: string,
  ) {
    const sellerId = req.user.sellerId;

    // Verify endpoint belongs to seller
    const ep = await this.prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, sellerId },
    });
    if (!ep) return [];

    return this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit || '50', 10), 100),
      select: {
        id: true,
        eventType: true,
        statusCode: true,
        success: true,
        attempts: true,
        duration: true,
        error: true,
        createdAt: true,
      },
    });
  }
}
