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
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellerService } from './seller.service';

/**
 * Seller profile endpoints.
 * All routes require a valid JWT (JwtAuthGuard).
 * sellerId is always extracted from the JWT payload — never from a route param.
 * This enforces strict tenant isolation at the controller boundary.
 */
@Controller('sellers')
@UseGuards(JwtAuthGuard)
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  /**
   * GET /api/sellers/me
   * Returns the authenticated seller's profile.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.sellerService.getProfile(user.sellerId);
  }

  /**
   * PATCH /api/sellers/me
   * Updates name and/or logoUrl for the authenticated seller.
   * At least one field must be provided.
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSellerDto,
  ) {
    return this.sellerService.updateProfile(user.sellerId, dto);
  }
}
