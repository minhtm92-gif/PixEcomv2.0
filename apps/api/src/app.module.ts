<<<<<<< HEAD
<<<<<<< HEAD
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
=======
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EmailModule } from './email/email.module';
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
=======
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EmailModule } from './email/email.module';
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
import { AdsManagerModule } from './ads-manager/ads-manager.module';
import { AdStrategiesModule } from './ad-strategies/ad-strategies.module';
import { AdUnitsModule } from './ad-units/ad-units.module';
import { AdminModule } from './admin/admin.module';
import { CampaignsModule } from './campaigns/campaigns.module';
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
<<<<<<< HEAD
<<<<<<< HEAD
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
=======
=======
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
import { StorefrontModule } from './storefront/storefront.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PaymentGatewaysModule } from './payment-gateways/payment-gateways.module';
import { WebhookOutboundModule } from './webhook-outbound/webhook-outbound.module';
import { InternalModule } from './internal/internal.module';
import { EmailMarketingModule } from './email-marketing/email-marketing.module';
<<<<<<< HEAD
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
=======
>>>>>>> feature/2.4.2-alpha-ads-seed-v1

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
<<<<<<< HEAD
<<<<<<< HEAD
    ScheduleModule.forRoot(),
=======
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
=======
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
    PrismaModule,
    EmailModule,
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
    CampaignsModule,
    AdUnitsModule,
    AdminModule,
    StorefrontModule,
    WebhooksModule,
    WebhookOutboundModule,
    PaymentGatewaysModule,
    InternalModule,
    EmailMarketingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // WS2: Attach request ID to every inbound request
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
