import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSellerSettingsDto } from './dto/update-seller-settings.dto';

@Injectable()
export class SellerSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns settings for the given sellerId.
   * sellerId is always sourced from the JWT — never from request params.
   */
  async getSettings(sellerId: string) {
    const settings = await this.prisma.sellerSettings.findUnique({
      where: { sellerId },
      select: {
        id: true,
        sellerId: true,
        brandName: true,
        defaultCurrency: true,
        timezone: true,
        supportEmail: true,
        metaPixelId: true,
        googleAnalyticsId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!settings) {
      throw new NotFoundException('Seller settings not found');
    }

    return settings;
  }

  /**
   * Updates one or more settings fields for the given seller.
   * At least one field must be provided.
   * sellerId scopes the update — cannot touch another seller's settings row.
   */
  async updateSettings(sellerId: string, dto: UpdateSellerSettingsDto) {
    const hasAnyField = Object.values(dto).some((v) => v !== undefined);
    if (!hasAnyField) {
      throw new BadRequestException('At least one field must be provided');
    }

    // Verify settings row exists
    const existing = await this.prisma.sellerSettings.findUnique({
      where: { sellerId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Seller settings not found');
    }

    const updated = await this.prisma.sellerSettings.update({
      where: { sellerId },
      data: {
        ...(dto.brandName !== undefined && { brandName: dto.brandName }),
        ...(dto.defaultCurrency !== undefined && {
          defaultCurrency: dto.defaultCurrency,
        }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.supportEmail !== undefined && {
          supportEmail: dto.supportEmail,
        }),
        ...(dto.metaPixelId !== undefined && { metaPixelId: dto.metaPixelId }),
        ...(dto.googleAnalyticsId !== undefined && {
          googleAnalyticsId: dto.googleAnalyticsId,
        }),
      },
      select: {
        id: true,
        sellerId: true,
        brandName: true,
        defaultCurrency: true,
        timezone: true,
        supportEmail: true,
        metaPixelId: true,
        googleAnalyticsId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
