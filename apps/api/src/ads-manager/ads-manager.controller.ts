import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdsManagerReadService } from './ads-manager-read.service';
import { CampaignsQueryDto } from './dto/campaigns-query.dto';
import { AdsetsQueryDto } from './dto/adsets-query.dto';
import { AdsQueryDto } from './dto/ads-query.dto';
import { FiltersQueryDto } from './dto/filters-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('ads-manager')
export class AdsManagerController {
  constructor(private readonly service: AdsManagerReadService) {}

  @Get('campaigns')
  getCampaigns(@Req() req: any, @Query() query: CampaignsQueryDto) {
    return this.service.getCampaigns(req.user.sellerId, query);
  }

  @Get('adsets')
  getAdsets(@Req() req: any, @Query() query: AdsetsQueryDto) {
    return this.service.getAdsets(req.user.sellerId, query);
  }

  @Get('ads')
  getAds(@Req() req: any, @Query() query: AdsQueryDto) {
    return this.service.getAds(req.user.sellerId, query);
  }

  @Get('filters')
  getFilters(@Req() req: any, @Query() query: FiltersQueryDto) {
    return this.service.getFilters(
      req.user.sellerId,
      query.campaignId,
      query.adsetId,
    );
  }
}
