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
import { AdminFbConnectionsQueryDto } from './dto/admin-fb-connections-query.dto';

@Controller('admin')
@UseGuards(SuperadminGuard)
export class AdminFbConnectionsController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /api/admin/fb-connections — all connections across all sellers */
  @Get('fb-connections')
  listAllFbConnections(@Query() query: AdminFbConnectionsQueryDto) {
    return this.adminService.getAllFbConnections(query);
  }

  /** GET /api/admin/sellers/:sellerId/fb-connections — connections for a specific seller */
  @Get('sellers/:sellerId/fb-connections')
  listSellerFbConnections(
    @Param('sellerId', ParseUUIDPipe) sellerId: string,
  ) {
    return this.adminService.getSellerFbConnections(sellerId);
  }
}
