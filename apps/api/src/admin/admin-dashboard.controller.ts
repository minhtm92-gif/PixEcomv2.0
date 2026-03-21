import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(SuperadminGuard)
export class AdminDashboardController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }
}
