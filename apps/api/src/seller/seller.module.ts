import { Module } from '@nestjs/common';
import { SellerSettingsController } from './seller-settings.controller';
import { SellerSettingsService } from './seller-settings.service';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';

@Module({
  // PrismaModule is @Global() — no import needed
  providers: [SellerService, SellerSettingsService],
  controllers: [SellerController, SellerSettingsController],
  exports: [SellerService],
})
export class SellerModule {}
