import { Module } from '@nestjs/common';
import { AdsManagerController } from './ads-manager.controller';
import { AdsManagerService } from './ads-manager.service';

@Module({
  controllers: [AdsManagerController],
  providers: [AdsManagerService],
})
export class AdsManagerModule {}
