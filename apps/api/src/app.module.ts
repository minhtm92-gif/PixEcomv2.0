import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SellerModule } from './seller/seller.module';
import { SellpagesModule } from './sellpages/sellpages.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ScheduleModule.forRoot(),
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // WS2: Attach request ID to every inbound request
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
