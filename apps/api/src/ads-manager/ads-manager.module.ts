import { Module } from '@nestjs/common';
import { AdsManagerController } from './ads-manager.controller';
import { AdsManagerService } from './ads-manager.service';

@Module({
  providers: [AdsManagerService],
  controllers: [AdsManagerController],
})
export class AdsManagerModule {}
