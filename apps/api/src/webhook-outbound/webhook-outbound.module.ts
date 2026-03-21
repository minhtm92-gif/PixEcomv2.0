import { Global, Module } from '@nestjs/common';
import { WebhookOutboundService } from './webhook-outbound.service';
import { WebhookOutboundController } from './webhook-outbound.controller';

@Global()
@Module({
  providers: [WebhookOutboundService],
  controllers: [WebhookOutboundController],
  exports: [WebhookOutboundService],
})
export class WebhookOutboundModule {}
