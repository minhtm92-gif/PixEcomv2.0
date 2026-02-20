import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // PrismaModule is @Global() — PrismaService is injected without explicit import
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
