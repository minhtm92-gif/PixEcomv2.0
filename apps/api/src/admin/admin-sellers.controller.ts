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
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';

@Controller('admin/sellers')
@UseGuards(SuperadminGuard)
export class AdminSellersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listSellers(@Query() query: AdminQueryDto) {
    return this.adminService.listSellers(query);
  }

  @Get(':id')
  getSellerDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getSellerDetail(id);
  }

  @Post()
  createSeller(@Body() dto: CreateSellerDto) {
    return this.adminService.createSeller(dto);
  }

  @Patch(':id')
  updateSeller(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSellerDto,
  ) {
    return this.adminService.updateSeller(id, dto);
  }
}
