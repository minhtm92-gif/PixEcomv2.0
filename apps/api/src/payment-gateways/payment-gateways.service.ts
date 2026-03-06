import { Injectable } from '@nestjs/common';

export interface PaymentGatewayInfo {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  supportedCurrencies: string[];
  disputeSupport: boolean;
  webhookSupport: boolean;
  description: string;
}

const GATEWAYS: PaymentGatewayInfo[] = [
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'paypal',
    isActive: true,
    supportedCurrencies: ['USD'],
    disputeSupport: true,
    webhookSupport: true,
    description: 'PayPal payment gateway',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    type: 'stripe',
    isActive: true,
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    disputeSupport: true,
    webhookSupport: true,
    description: 'Stripe payment gateway',
  },
];

@Injectable()
export class PaymentGatewaysService {
  findAll(): PaymentGatewayInfo[] {
    return GATEWAYS;
  }
}
