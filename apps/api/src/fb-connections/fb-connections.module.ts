import { Module } from '@nestjs/common';
import { MetaModule } from '../meta/meta.module';
import { FbConnectionsController } from './fb-connections.controller';
import { FbConnectionsService } from './fb-connections.service';

@Module({
  imports: [MetaModule],
  providers: [FbConnectionsService],
  controllers: [FbConnectionsController],
  exports: [FbConnectionsService],
})
export class FbConnectionsModule {}
