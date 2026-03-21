import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripePaymentService {
  private readonly logger = new Logger(StripePaymentService.name);
  private readonly stripe: Stripe;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY', ''));
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const pi = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: currency.toLowerCase(),
      metadata,
      automatic_payment_methods: { enabled: true },
    });

    this.logger.log(`PaymentIntent created: ${pi.id} for $${amount}`);

    return {
      clientSecret: pi.client_secret!,
      paymentIntentId: pi.id,
    };
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<{ status: string; id: string }> {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    return { status: pi.status, id: pi.id };
  }
}
