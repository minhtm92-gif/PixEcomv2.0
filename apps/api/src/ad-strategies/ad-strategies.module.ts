import { Module } from '@nestjs/common';
import { AdStrategiesController } from './ad-strategies.controller';
import { AdStrategiesService } from './ad-strategies.service';

@Module({
  providers: [AdStrategiesService],
  controllers: [AdStrategiesController],
  exports: [AdStrategiesService],
})
export class AdStrategiesModule {}
