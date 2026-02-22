import { Module } from '@nestjs/common';
import { MetaModule } from '../meta/meta.module';
import { AdsManagerController } from './ads-manager.controller';
import { AdsManagerReadService } from './ads-manager-read.service';
import { AdsManagerActionService } from './ads-manager-action.service';

@Module({
  imports: [MetaModule],
  controllers: [AdsManagerController],
  providers: [AdsManagerReadService, AdsManagerActionService],
})
export class AdsManagerModule {}
