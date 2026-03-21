import { Controller, Get } from '@nestjs/common';
import { PaymentGatewaysService } from './payment-gateways.service';

@Controller('payment-gateways')
export class PaymentGatewaysController {
  constructor(private readonly service: PaymentGatewaysService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
