import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller';
import { MetaRateLimiter } from './meta-rate-limiter';
import { MetaService } from './meta.service';
import { MetaTokenService } from './meta-token.service';

@Module({
  providers: [MetaTokenService, MetaRateLimiter, MetaService],
  controllers: [MetaController],
  // Export MetaService + MetaTokenService so other modules (e.g. stats worker)
  // can inject the Meta HTTP client and token encryption without re-declaring.
  exports: [MetaService, MetaTokenService, MetaRateLimiter],
})
export class MetaModule {}
