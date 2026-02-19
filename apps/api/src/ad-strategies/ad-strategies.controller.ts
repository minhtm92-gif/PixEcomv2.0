import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AdStrategiesService } from './ad-strategies.service';
import { CreateAdStrategyDto } from './dto/create-ad-strategy.dto';
import { ListAdStrategiesDto } from './dto/list-ad-strategies.dto';
import { UpdateAdStrategyDto } from './dto/update-ad-strategy.dto';

/**
 * Ad Strategies — seller-scoped reusable campaign templates.
 *
 * Stores budget, audience mode, placements, and attribution config
 * as a JSON blob. Referenced when creating campaigns (Phase 2.3.2).
 *
 * All routes require JWT. sellerId sourced from JWT only.
 */
@Controller('fb/ad-strategies')
@UseGuards(JwtAuthGuard)
export class AdStrategiesController {
  constructor(private readonly service: AdStrategiesService) {}

  /**
   * POST /api/fb/ad-strategies
   * Create a new reusable ad strategy template.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdStrategyDto,
  ) {
    return this.service.createStrategy(user.sellerId, dto);
  }

  /**
   * GET /api/fb/ad-strategies
   * List strategies for the authenticated seller.
   * Default: active only. ?includeInactive=true includes disabled strategies.
   */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdStrategiesDto,
  ) {
    return this.service.listStrategies(user.sellerId, query);
  }

  /**
   * GET /api/fb/ad-strategies/:id
   * Get a single strategy (must belong to authenticated seller).
   */
  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getStrategy(user.sellerId, id);
  }

  /**
   * PATCH /api/fb/ad-strategies/:id
   * Update name / budget / audience / placements / isActive.
   * config is merged — only supplied fields are updated.
   */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdStrategyDto,
  ) {
    return this.service.updateStrategy(user.sellerId, id, dto);
  }

  /**
   * DELETE /api/fb/ad-strategies/:id
   * Soft-disables a strategy (sets isActive=false).
   * Returns 200 { ok: true, id, isActive: false }.
   */
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteStrategy(user.sellerId, id);
  }
}
