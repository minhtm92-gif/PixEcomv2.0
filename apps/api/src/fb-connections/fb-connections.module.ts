import { Module } from '@nestjs/common';
import { FbConnectionsController } from './fb-connections.controller';
import { FbConnectionsService } from './fb-connections.service';

@Module({
  providers: [FbConnectionsService],
  controllers: [FbConnectionsController],
  exports: [FbConnectionsService],
})
export class FbConnectionsModule {}
