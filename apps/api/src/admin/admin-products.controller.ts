import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { AdminService } from './admin.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { BulkUpdateVariantsDto } from './dto/bulk-update-variants.dto';

@Controller('admin/products')
@UseGuards(SuperadminGuard)
export class AdminProductsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listProducts(@Query() query: AdminQueryDto) {
    return this.adminService.listProducts(query);
  }

  @Get('labels')
  listLabels() {
    return this.adminService.listLabels();
  }

  @Post('labels')
  createLabel(@Body() body: { name: string }) {
    return this.adminService.createLabel(body.name);
  }

  @Post('upload')
  getUploadUrl(@Body() body: { filename: string; contentType: string }) {
    return this.adminService.getProductUploadUrl(body.filename, body.contentType);
  }

  @Get(':id')
  getProductDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getProductDetail(id);
  }

  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  @Patch(':id')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.adminService.updateProduct(id, dto);
  }

  // ─── VARIANTS ─────────────────────────────────────────────────────────

  @Post(':id/variants')
  createVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.adminService.createVariant(id, dto);
  }

  @Patch(':id/variants/bulk')
  bulkUpdateVariants(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpdateVariantsDto,
  ) {
    return this.adminService.bulkUpdateVariants(id, dto);
  }

  @Post(':id/generate-variants')
  generateVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.generateVariants(id);
  }

  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.adminService.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  deleteVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.adminService.deleteVariant(id, variantId);
  }

  // ─── LABELS ───────────────────────────────────────────────────────────

  @Post(':id/labels/sync')
  syncLabels(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { labelIds: string[] },
  ) {
    return this.adminService.syncProductLabels(id, body.labelIds);
  }

  // ─── PRICING RULES ───────────────────────────────────────────────────

  @Post(':id/pricing-rules')
  createPricingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    return this.adminService.createPricingRule(id, body);
  }

  @Patch(':id/pricing-rules/:ruleId')
  updatePricingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() body: any,
  ) {
    return this.adminService.updatePricingRule(id, ruleId, body);
  }

  @Delete(':id/pricing-rules/:ruleId')
  deletePricingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.adminService.deletePricingRule(id, ruleId);
  }
}
