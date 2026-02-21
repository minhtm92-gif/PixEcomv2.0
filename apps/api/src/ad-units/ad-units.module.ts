import { Module } from '@nestjs/common';
import { AdUnitsService } from './ad-units.service';
import { AdsetsController, CampaignAdsetsController } from './adsets.controller';
import { AdsController, AdsetAdsController } from './ads.controller';

/**
 * AdUnitsModule — Adset + Ad + AdPost CRUD.
 *
 * Controllers registered:
 *   CampaignAdsetsController  →  /campaigns/:campaignId/adsets
 *   AdsetsController          →  /adsets/:id
 *   AdsetAdsController        →  /adsets/:adsetId/ads
 *   AdsController             →  /ads/:id  +  /ads/:adId/ad-post
 */
@Module({
  providers: [AdUnitsService],
  controllers: [
    CampaignAdsetsController,
    AdsetsController,
    AdsetAdsController,
    AdsController,
  ],
  exports: [AdUnitsService],
})
export class AdUnitsModule {}
