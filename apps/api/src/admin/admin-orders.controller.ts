import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { AdminService } from './admin.service';
import { AdminQueryDto } from './dto/admin-query.dto';

@Controller('admin/orders')
@UseGuards(SuperadminGuard)
export class AdminOrdersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listOrders(@Query() query: AdminQueryDto) {
    return this.adminService.listOrders(query);
  }

  @Get(':id')
  getOrderDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getOrderDetail(id);
  }
}
