import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetRegistryModule } from './asset-registry/asset-registry.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CreativesModule } from './creatives/creatives.module';
import { DomainsModule } from './domains/domains.module';
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
    CampaignsModule,
  ],
})
export class AppModule {}
