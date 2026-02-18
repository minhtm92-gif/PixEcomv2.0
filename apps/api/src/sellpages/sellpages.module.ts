import { Module } from '@nestjs/common';
import { SellpagesController } from './sellpages.controller';
import { SellpagesService } from './sellpages.service';

@Module({
  providers: [SellpagesService],
  controllers: [SellpagesController],
  exports: [SellpagesService],
})
export class SellpagesModule {}
