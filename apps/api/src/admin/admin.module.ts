import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminStoresController } from './admin-stores.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [
    AdminDashboardController,
    AdminSellersController,
    AdminOrdersController,
    AdminProductsController,
    AdminStoresController,
    AdminAnalyticsController,
    AdminSettingsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
