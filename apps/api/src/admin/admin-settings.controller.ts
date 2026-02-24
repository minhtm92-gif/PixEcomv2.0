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
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

@Controller('admin')
@UseGuards(SuperadminGuard)
export class AdminSettingsController {
  constructor(private readonly adminService: AdminService) {}

  // ─── PLATFORM SETTINGS ──────────────────────────────────────────────────────

  @Get('settings')
  getPlatformSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Patch('settings')
  updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updatePlatformSettings(dto);
  }

  // ─── PAYMENT GATEWAYS ──────────────────────────────────────────────────────

  @Get('payment-gateways')
  listPaymentGateways() {
    return this.adminService.listPaymentGateways();
  }

  @Post('payment-gateways')
  createPaymentGateway(@Body() dto: CreatePaymentGatewayDto) {
    return this.adminService.createPaymentGateway(dto);
  }

  @Patch('payment-gateways/:id')
  updatePaymentGateway(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updatePaymentGateway(id, body);
  }

  @Delete('payment-gateways/:id')
  deletePaymentGateway(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deletePaymentGateway(id);
  }

  // ─── DISCOUNTS ─────────────────────────────────────────────────────────────

  @Get('discounts')
  listDiscounts() {
    return this.adminService.listDiscounts();
  }

  @Post('discounts')
  createDiscount(@Body() dto: CreateDiscountDto) {
    return this.adminService.createDiscount(dto);
  }

  @Patch('discounts/:id')
  updateDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updateDiscount(id, body);
  }

  @Delete('discounts/:id')
  deleteDiscount(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteDiscount(id);
  }

  // ─── ADMIN USERS ───────────────────────────────────────────────────────────

  @Get('users')
  listAdminUsers() {
    return this.adminService.listAdminUsers();
  }

  @Post('users')
  createAdminUser(@Body() dto: CreateAdminUserDto) {
    return this.adminService.createAdminUser(dto);
  }

  @Patch('users/:id')
  updateAdminUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updateAdminUser(id, body);
  }

  // ─── CONTENT PERFORMANCE ───────────────────────────────────────────────────

  @Get('content-performance')
  getContentPerformance(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getContentPerformance(from, to);
  }
}
