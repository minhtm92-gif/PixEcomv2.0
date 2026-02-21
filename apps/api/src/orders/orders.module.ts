import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { OrdersBulkService } from './orders-bulk.service';
import { OrdersController } from './orders.controller';
import { OrdersExportService } from './orders-export.service';
import { OrdersImportService } from './orders-import.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    // Memory storage: file buffers stay in RAM, no disk writes.
    // Max file size enforced per-interceptor in the controller (2 MB).
    MulterModule.register({ dest: undefined }),
  ],
  providers: [OrdersService, OrdersExportService, OrdersImportService, OrdersBulkService],
  controllers: [OrdersController],
})
export class OrdersModule {}
