import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AdsManagerService } from './ads-manager.service';
import { SyncRequestDto } from './dto/sync-request.dto';

@Controller('ads-manager')
@UseGuards(JwtAuthGuard)
export class AdsManagerController {
  constructor(private readonly service: AdsManagerService) {}

  /**
   * POST /api/ads-manager/sync
   *
   * Manually enqueue a stats-sync for the authenticated seller.
   * Enqueues 3 jobs (CAMPAIGN / ADSET / AD) for the given date (defaults to today UTC).
   * Returns 202 Accepted immediately — jobs are processed asynchronously.
   */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async sync(
    @CurrentUser() user: AuthUser,
    @Body() dto: SyncRequestDto,
  ) {
    const date = dto.date ?? this.service.todayUTC();
    const jobIds = await this.service.enqueueSync(user.sellerId, date);
    return { enqueued: jobIds.length, jobIds };
  }
}
