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
import { CreateFbConnectionDto } from './dto/create-fb-connection.dto';
import { ListFbConnectionsDto } from './dto/list-fb-connections.dto';
import { UpdateFbConnectionDto } from './dto/update-fb-connection.dto';
import { FbConnectionsService } from './fb-connections.service';

/**
 * FB Connections — seller-scoped connection metadata management.
 *
 * Stores Facebook Ad Account / Page / Pixel / Conversion connection references.
 * Phase 2.3.1: metadata only — no access tokens stored or returned.
 *
 * All routes require JWT. sellerId sourced from JWT only (never route params).
 */
@Controller('fb/connections')
@UseGuards(JwtAuthGuard)
export class FbConnectionsController {
  constructor(private readonly service: FbConnectionsService) {}

  /**
   * POST /api/fb/connections
   * Create a new FB connection for the authenticated seller.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFbConnectionDto,
  ) {
    return this.service.createConnection(user.sellerId, dto);
  }

  /**
   * GET /api/fb/connections
   * List all connections for the authenticated seller.
   * Optional filter: ?connectionType=AD_ACCOUNT
   */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListFbConnectionsDto,
  ) {
    return this.service.listConnections(user.sellerId, query);
  }

  /**
   * GET /api/fb/connections/:id
   * Get a single connection by ID (must belong to authenticated seller).
   */
  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getConnection(user.sellerId, id);
  }

  /**
   * PATCH /api/fb/connections/:id
   * Update name / isPrimary / isActive.
   * connectionType, externalId, parentId are immutable.
   */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFbConnectionDto,
  ) {
    return this.service.updateConnection(user.sellerId, id, dto);
  }

  /**
   * DELETE /api/fb/connections/:id
   * Soft-disables a connection (sets isActive=false).
   * Returns 200 { ok: true, id, isActive: false }.
   */
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteConnection(user.sellerId, id);
  }
}
