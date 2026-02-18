import { Module } from '@nestjs/common';
import { CreativesController } from './creatives.controller';
import { CreativesService } from './creatives.service';

@Module({
  providers: [CreativesService],
  controllers: [CreativesController],
})
export class CreativesModule {}
