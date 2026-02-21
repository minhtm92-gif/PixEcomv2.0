import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdsManagerModule } from './ads-manager/ads-manager.module';
import { AdStrategiesModule } from './ad-strategies/ad-strategies.module';
import { OrdersModule } from './orders/orders.module';
import { AssetRegistryModule } from './asset-registry/asset-registry.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CreativesModule } from './creatives/creatives.module';
import { DomainsModule } from './domains/domains.module';
import { FbConnectionsModule } from './fb-connections/fb-connections.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { MetaModule } from './meta/meta.module';
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
    AdsManagerModule,
    AdStrategiesModule,
    OrdersModule,
    MetaModule,
  ],
})
export class AppModule {}
