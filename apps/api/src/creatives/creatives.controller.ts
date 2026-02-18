import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreativesService } from './creatives.service';
import { AttachAssetDto } from './dto/attach-asset.dto';
import { CreateCreativeDto } from './dto/create-creative.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';

@Controller('creatives')
@UseGuards(JwtAuthGuard)
export class CreativesController {
  constructor(private readonly service: CreativesService) {}

  // ─── POST /api/creatives ──────────────────────────────────────────────────
  @Post()
  createCreative(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCreativeDto,
  ) {
    return this.service.createCreative(user.sellerId, dto);
  }

  // ─── GET /api/creatives ───────────────────────────────────────────────────
  @Get()
  listCreatives(@CurrentUser() user: AuthUser) {
    return this.service.listCreatives(user.sellerId);
  }

  // ─── GET /api/creatives/:id ───────────────────────────────────────────────
  @Get(':id')
  getCreative(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getCreative(user.sellerId, id);
  }

  // ─── PATCH /api/creatives/:id ─────────────────────────────────────────────
  @Patch(':id')
  updateCreative(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreativeDto,
  ) {
    return this.service.updateCreative(user.sellerId, id, dto);
  }

  // ─── POST /api/creatives/:id/assets ──────────────────────────────────────
  /**
   * Attach (or replace) an asset in a role slot.
   * Upserts: attaching to an occupied role replaces the previous asset.
   */
  @Post(':id/assets')
  attachAsset(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachAssetDto,
  ) {
    return this.service.attachAsset(user.sellerId, id, dto);
  }

  // ─── DELETE /api/creatives/:id/assets/:role ──────────────────────────────
  /**
   * Detach the asset in a given role slot.
   */
  @Delete(':id/assets/:role')
  detachAsset(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: string,
  ) {
    return this.service.detachAsset(user.sellerId, id, role);
  }

  // ─── POST /api/creatives/:id/validate ────────────────────────────────────
  /**
   * Validate the creative and transition DRAFT → READY.
   * Requires: (PRIMARY_VIDEO OR THUMBNAIL) + PRIMARY_TEXT
   */
  @Post(':id/validate')
  validateCreative(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.validateCreative(user.sellerId, id);
  }
}
