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
import { CreateStoreDto } from './dto/create-store.dto';

@Controller('admin/stores')
@UseGuards(SuperadminGuard)
export class AdminStoresController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listStores(@Query() query: AdminQueryDto) {
    return this.adminService.listStores(query);
  }

  @Get(':id')
  getStoreDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getStoreDetail(id);
  }

  @Post()
  createStore(@Body() dto: CreateStoreDto) {
    return this.adminService.createStore(dto);
  }

  @Patch(':id')
  updateStore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.adminService.updateStore(id, body);
  }
}
