import { Module } from '@nestjs/common';
import { AdsManagerController } from './ads-manager.controller';
import { AdsManagerReadService } from './ads-manager-read.service';
import { StoreMetricsService } from './store-metrics.service';

@Module({
  controllers: [AdsManagerController],
  providers: [AdsManagerReadService, StoreMetricsService],
  exports: [StoreMetricsService],
})
export class AdsManagerModule {}
