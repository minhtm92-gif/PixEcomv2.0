import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminStoresController } from './admin-stores.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminFbConnectionsController } from './admin-fb-connections.controller';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  imports: [MediaModule],
  controllers: [
    AdminDashboardController,
    AdminSellersController,
    AdminOrdersController,
    AdminProductsController,
    AdminStoresController,
    AdminAnalyticsController,
    AdminSettingsController,
    AdminFbConnectionsController,
  ],
  providers: [AdminService, AdminAnalyticsService],
})
export class AdminModule {}
