import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { AdminService } from './admin.service';

@Controller('admin/analytics')
@UseGuards(SuperadminGuard)
export class AdminAnalyticsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getAnalytics(from, to);
  }
}
