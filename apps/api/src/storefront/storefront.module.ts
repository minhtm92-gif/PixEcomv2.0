import { Module } from '@nestjs/common';
import { StorefrontController } from './storefront.controller';
import { StorefrontService } from './storefront.service';
import { ReviewsService } from './reviews.service';
import { StripePaymentService } from './payments/stripe.service';
import { PayPalPaymentService } from './payments/paypal.service';

@Module({
  controllers: [StorefrontController],
  providers: [StorefrontService, ReviewsService, StripePaymentService, PayPalPaymentService],
  exports: [ReviewsService],
})
export class StorefrontModule {}
