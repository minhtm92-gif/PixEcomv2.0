import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdUnitsService } from './ad-units.service';
import { AdsetsController, CampaignAdsetsController } from './adsets.controller';
import { AdsController, AdsetAdsController } from './ads.controller';

/**
 * AdUnitsModule — Adset + Ad + AdPost CRUD.
 *
 * Controllers registered:
 *   CampaignAdsetsController  →  /campaigns/:campaignId/adsets
 *   AdsetsController          →  /adsets/:id  (+ /pause, /resume)
 *   AdsetAdsController        →  /adsets/:adsetId/ads
 *   AdsController             →  /ads/:id  +  /ads/:adId/ad-post  (+ /pause, /resume)
 *
 * Imports CampaignsModule for pause/resume lifecycle (MetaService already wired there).
 */
@Module({
  imports: [CampaignsModule],
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
