import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PayPalWebhookController } from './paypal-webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [StripeWebhookController, PayPalWebhookController],
  providers: [WebhookService],
})
export class WebhooksModule {}
