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
import { CreateAdsetDto } from './dto/create-adset.dto';
import { UpdateAdsetDto } from './dto/update-adset.dto';

/**
 * Adset endpoints:
 *   POST   /api/campaigns/:campaignId/adsets
 *   GET    /api/campaigns/:campaignId/adsets
 *   GET    /api/adsets/:id
 *   PATCH  /api/adsets/:id
 *   PATCH  /api/adsets/:id/pause
 *   PATCH  /api/adsets/:id/resume
 */

// ─── Nested: /campaigns/:campaignId/adsets ────────────────────────────────────

@Controller('campaigns/:campaignId/adsets')
@UseGuards(JwtAuthGuard)
export class CampaignAdsetsController {
  constructor(private readonly service: AdUnitsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: CreateAdsetDto,
  ) {
    return this.service.createAdset(user.sellerId, campaignId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listAdsets(
      user.sellerId,
      campaignId,
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}

// ─── Top-level: /adsets/:id ───────────────────────────────────────────────────

@Controller('adsets')
@UseGuards(JwtAuthGuard)
export class AdsetsController {
  constructor(
    private readonly service: AdUnitsService,
    private readonly campaignsService: CampaignsService,
  ) {}

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getAdset(user.sellerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdsetDto,
  ) {
    return this.service.updateAdset(user.sellerId, id, dto);
  }

  /**
   * PATCH /api/adsets/:id/pause
   * Inline pause for adset. Graceful Meta sync.
   */
  @Patch(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.pauseAdset(user.sellerId, id);
  }

  /**
   * PATCH /api/adsets/:id/resume
   * Inline resume for adset. Graceful Meta sync.
   */
  @Patch(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.resumeAdset(user.sellerId, id);
  }
}
