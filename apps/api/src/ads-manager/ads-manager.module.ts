import { Module } from '@nestjs/common';
import { AdsManagerController } from './ads-manager.controller';
import { AdsManagerReadService } from './ads-manager-read.service';

@Module({
  controllers: [AdsManagerController],
  providers: [AdsManagerReadService],
})
export class AdsManagerModule {}
