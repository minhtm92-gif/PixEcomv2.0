import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalProductsService } from './internal-products.service';

@Controller('internal/products')
export class InternalProductsController {
  constructor(
    private readonly service: InternalProductsService,
    private readonly config: ConfigService,
  ) {}

  private validateApiKey(apiKey: string | undefined): void {
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected || apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  @Post()
  @HttpCode(201)
  createProduct(
    @Headers('x-internal-key') apiKey: string,
    @Body()
    body: {
      name: string;
      description?: string;
      images?: string[];
      variants?: Array<{
        name: string;
        price: number;
        compareAtPrice?: number;
        costPrice?: number;
        options?: Record<string, string>;
        image?: string;
      }>;
      quantityCosts?: Record<string, number>;
      allowOutOfStockPurchase?: boolean;
    },
  ) {
    this.validateApiKey(apiKey);
    return this.service.createFromPixcon(body);
  }

  @Post(':id/sellpages')
  @HttpCode(201)
  createSellpages(
    @Headers('x-internal-key') apiKey: string,
    @Param('id') productId: string,
    @Body()
    body: {
      sellerId: string;
      sellpages: Array<{
        slug: string;
        titleOverride?: string;
        descriptionOverride?: string;
        seoTitle?: string;
        seoDescription?: string;
        seoOgImage?: string;
        sections?: unknown;
        headerConfig?: unknown;
        footerConfig?: unknown;
        boostModules?: unknown;
        discountRules?: unknown;
        pixconSellpageId?: string;
      }>;
    },
  ) {
    this.validateApiKey(apiKey);
    return this.service.createSellpagesFromPixcon(
      productId,
      body.sellerId,
      body.sellpages,
    );
  }

  @Post(':id/videos')
  @HttpCode(201)
  addVideos(
    @Headers('x-internal-key') apiKey: string,
    @Param('id') productId: string,
    @Body()
    body: {
      videos: Array<{
        url: string;
        filename?: string;
        durationSec?: number;
        fileSize?: number;
      }>;
    },
  ) {
    this.validateApiKey(apiKey);
    return this.service.addVideos(productId, body.videos);
  }
}
