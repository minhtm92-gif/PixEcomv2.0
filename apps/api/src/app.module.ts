import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdStrategiesModule } from './ad-strategies/ad-strategies.module';
import { AdsManagerModule } from './ads-manager/ads-manager.module';
import { AssetRegistryModule } from './asset-registry/asset-registry.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CreativesModule } from './creatives/creatives.module';
import { DomainsModule } from './domains/domains.module';
import { FbConnectionsModule } from './fb-connections/fb-connections.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SellerModule } from './seller/seller.module';
import { SellpagesModule } from './sellpages/sellpages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    SellerModule,
    ProductsModule,
    AssetsModule,
    SellpagesModule,
    DomainsModule,
    MediaModule,
    AssetRegistryModule,
    CreativesModule,
    FbConnectionsModule,
    AdStrategiesModule,
    AdsManagerModule,
  ],
})
export class AppModule {}
