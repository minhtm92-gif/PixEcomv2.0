import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersTrackingService } from './orders-tracking.service';
import { SevenTrackProvider } from './tracking/seventeen-track.provider';
import { TrackingSchedulerService } from './tracking-scheduler.service';
import { TrackingRateLimitGuard } from './guards/tracking-rate-limit.guard';

/**
 * OrdersModule
 *
 * ScheduleModule.forRoot() is registered globally in AppModule.
 * @Cron decorators in TrackingSchedulerService will be picked up automatically.
 */
@Module({
  imports: [
    HttpModule, // provides HttpService for SevenTrackProvider
  ],
  providers: [
    OrdersService,
    OrdersTrackingService,
    SevenTrackProvider,
    TrackingSchedulerService,
    TrackingRateLimitGuard,
  ],
  controllers: [OrdersController],
})
export class OrdersModule {}
