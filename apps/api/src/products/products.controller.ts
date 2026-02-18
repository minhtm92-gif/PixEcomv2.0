import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListProductsDto } from './dto/list-products.dto';
import { ProductsService } from './products.service';

/**
 * Product catalog endpoints — read-only, platform-level.
 *
 * All routes require a valid JWT (JwtAuthGuard).
 * Products are platform-owned: NO sellerId scoping is applied.
 * Sellers can read the catalog but cannot mutate it.
 */
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * GET /api/products
   *
   * Returns a paginated catalog of ACTIVE products.
   *
   * Query params:
   *   page  — page number, default 1
   *   limit — items per page, default 20, max 100
   *   label — filter by label slug (e.g. "bestseller")
   *   q     — search by name or product code (case-insensitive contains)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listProducts(@Query() query: ListProductsDto) {
    return this.productsService.listProducts(query);
  }

  /**
   * GET /api/products/:id
   *
   * Returns full product detail including active variants.
   * 404 if product does not exist or is not ACTIVE.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getProduct(id);
  }

  /**
   * GET /api/products/:id/variants
   *
   * Returns the list of active variants for a product.
   * Provided as a separate endpoint for clients that want
   * lightweight product cards first, then variant detail on demand.
   * 404 if product does not exist or is not ACTIVE.
   */
  @Get(':id/variants')
  @HttpCode(HttpStatus.OK)
  async getVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getVariants(id);
  }
}
