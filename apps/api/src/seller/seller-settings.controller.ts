import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { UpdateSellerSettingsDto } from './dto/update-seller-settings.dto';
import { SellerSettingsService } from './seller-settings.service';

/**
 * Seller settings endpoints.
 * All routes require a valid JWT (JwtAuthGuard).
 * sellerId is always extracted from the JWT payload — never from a route param.
 */
@Controller('sellers/me/settings')
@UseGuards(JwtAuthGuard)
export class SellerSettingsController {
  constructor(
    private readonly sellerSettingsService: SellerSettingsService,
  ) {}

  /**
   * GET /api/sellers/me/settings
   * Returns the authenticated seller's settings.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getSettings(@CurrentUser() user: AuthUser) {
    return this.sellerSettingsService.getSettings(user.sellerId);
  }

  /**
   * PATCH /api/sellers/me/settings
   * Updates one or more settings fields for the authenticated seller.
   */
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSellerSettingsDto,
  ) {
    return this.sellerSettingsService.updateSettings(user.sellerId, dto);
  }
}
