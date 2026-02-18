import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetsService } from './assets.service';

/**
 * Creative asset endpoints — read-only, platform-level.
 *
 * All routes require a valid JWT (JwtAuthGuard).
 * Assets are platform-owned: NO sellerId scoping applied.
 * No upload endpoints in this milestone (Phase 1).
 *
 * Version prefixes (informational):
 *   v1, v2 … — primary video/image variants
 *   b1, b2 … — B-roll / supplementary variants
 */
@Controller('products/:productId/assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  /**
   * GET /api/products/:productId/assets/media
   *
   * Returns all media assets (videos + images) for the product.
   * Items are ordered by version asc, position asc.
   * Each item includes Phase 1 stub stats: spend=0, roas=null.
   */
  @Get('media')
  @HttpCode(HttpStatus.OK)
  async getMedia(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.assetsService.getMedia(productId);
  }

  /**
   * GET /api/products/:productId/assets/thumbnails
   *
   * Returns all thumbnail assets for the product.
   * Items ordered by version asc, position asc.
   * Each item includes Phase 1 stub stats: spend=0, roas=null.
   */
  @Get('thumbnails')
  @HttpCode(HttpStatus.OK)
  async getThumbnails(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.assetsService.getThumbnails(productId);
  }

  /**
   * GET /api/products/:productId/assets/adtexts
   *
   * Returns all ad text assets for the product.
   * Items ordered by version asc.
   * Each item includes Phase 1 stub stats: spend=0, roas=null.
   */
  @Get('adtexts')
  @HttpCode(HttpStatus.OK)
  async getAdtexts(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.assetsService.getAdtexts(productId);
  }
}
