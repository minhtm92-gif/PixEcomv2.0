import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AdUnitsService } from './ad-units.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { CreateAdPostDto } from './dto/create-ad-post.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

/**
 * Ad endpoints:
 *   POST   /api/adsets/:adsetId/ads
 *   GET    /api/adsets/:adsetId/ads
 *   GET    /api/ads/:id
 *   PATCH  /api/ads/:id
 *   POST   /api/ads/:adId/ad-post
 *   PATCH  /api/ads/:id/pause
 *   PATCH  /api/ads/:id/resume
 */

// ─── Nested: /adsets/:adsetId/ads ────────────────────────────────────────────

@Controller('adsets/:adsetId/ads')
@UseGuards(JwtAuthGuard)
export class AdsetAdsController {
  constructor(private readonly service: AdUnitsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('adsetId', ParseUUIDPipe) adsetId: string,
    @Body() dto: CreateAdDto,
  ) {
    return this.service.createAd(user.sellerId, adsetId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('adsetId', ParseUUIDPipe) adsetId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listAds(
      user.sellerId,
      adsetId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}

// ─── Top-level: /ads/:id + /ads/:adId/ad-post ────────────────────────────────

@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(
    private readonly service: AdUnitsService,
    private readonly campaignsService: CampaignsService,
  ) {}

  /**
   * GET /ads/:id — detail with adPosts
   * Must be declared BEFORE :adId/ad-post to avoid NestJS routing ambiguity.
   */
  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getAd(user.sellerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdDto,
  ) {
    return this.service.updateAd(user.sellerId, id, dto);
  }

  /**
   * PATCH /api/ads/:id/pause
   * Inline pause for ad. Graceful Meta sync.
   */
  @Patch(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.pauseAd(user.sellerId, id);
  }

  /**
   * PATCH /api/ads/:id/resume
   * Inline resume for ad. Graceful Meta sync.
   */
  @Patch(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.resumeAd(user.sellerId, id);
  }

  /**
   * POST /ads/:adId/ad-post
   * Links an AdPost (page + assets) to an Ad.
   */
  @Post(':adId/ad-post')
  @HttpCode(HttpStatus.CREATED)
  createAdPost(
    @CurrentUser() user: AuthUser,
    @Param('adId', ParseUUIDPipe) adId: string,
    @Body() dto: CreateAdPostDto,
  ) {
    return this.service.createAdPost(user.sellerId, adId, dto);
  }
}
