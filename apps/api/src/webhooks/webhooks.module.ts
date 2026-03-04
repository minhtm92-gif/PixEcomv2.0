import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PayPalWebhookController } from './paypal-webhook.controller';
import { FulfillmentWebhookController } from './fulfillment-webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [StripeWebhookController, PayPalWebhookController, FulfillmentWebhookController],
  providers: [WebhookService],
})
export class WebhooksModule {}
