import { Module } from '@nestjs/common';
import { MetaModule } from '../meta/meta.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [
    // MetaModule exports MetaService, needed for launch/pause/resume
    MetaModule,
  ],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
