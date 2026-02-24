import {
  Body,
  Controller,
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

@Controller('admin/products')
@UseGuards(SuperadminGuard)
export class AdminProductsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listProducts(@Query() query: AdminQueryDto) {
    return this.adminService.listProducts(query);
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
}
