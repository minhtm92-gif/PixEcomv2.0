import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MediaModule } from '../media/media.module';
import { AssetRegistryController } from './asset-registry.controller';
import { AssetRegistryService } from './asset-registry.service';
import { ApiKeyOrSuperadminGuard } from './guards/api-key-or-superadmin.guard';

@Module({
  imports: [
    // Independent JwtModule instance so ApiKeyOrSuperadminGuard can verify
    // tokens without a circular dependency on AuthModule.
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
      inject: [ConfigService],
    }),
    MediaModule,
  ],
  providers: [AssetRegistryService, ApiKeyOrSuperadminGuard],
  controllers: [AssetRegistryController],
})
export class AssetRegistryModule {}
