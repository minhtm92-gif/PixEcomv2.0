import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AssetRegistryService } from './asset-registry.service';
import { ApiKeyOrSuperadminGuard } from './guards/api-key-or-superadmin.guard';
import { IngestAssetDto } from './dto/ingest-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { RegisterAssetDto } from './dto/register-asset.dto';
import { SignedUploadDto } from './dto/signed-upload.dto';

@Controller('assets')
export class AssetRegistryController {
  constructor(private readonly service: AssetRegistryService) {}

  // ─── POST /api/assets/signed-upload ─────────────────────────────────────
  /**
   * Returns a presigned PUT URL for direct R2 upload.
   * Client uploads the file directly, then calls POST /api/assets to register.
   *
   * Auth: seller JWT
   */
  @Post('signed-upload')
  @UseGuards(JwtAuthGuard)
  async getSignedUploadUrl(
    @CurrentUser() user: AuthUser,
    @Body() dto: SignedUploadDto,
  ) {
    return this.service.getSignedUploadUrl(user.sellerId, dto);
  }

  // ─── POST /api/assets/ingest ─────────────────────────────────────────────
  /**
   * Ingests an asset from an internal pipeline.
   * Idempotent: returns existing record if (sourceType, ingestionId) matches.
   *
   * Auth: X-Api-Key header OR superadmin JWT
   */
  @Post('ingest')
  @UseGuards(ApiKeyOrSuperadminGuard)
  async ingestAsset(@Body() dto: IngestAssetDto) {
    return this.service.ingestAsset(dto);
  }

  // ─── POST /api/assets ────────────────────────────────────────────────────
  /**
   * Registers an asset the seller just uploaded to R2.
   * De-duplicates by ingestionId or checksum.
   *
   * Auth: seller JWT
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async registerAsset(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterAssetDto,
  ) {
    return this.service.registerAsset(user.sellerId, dto);
  }

  // ─── GET /api/assets ─────────────────────────────────────────────────────
  /**
   * Returns paginated assets visible to this seller
   * (seller's own + platform assets).
   *
   * Auth: seller JWT
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listAssets(
    @CurrentUser() user: AuthUser,
    @Query() dto: ListAssetsDto,
  ) {
    return this.service.listAssets(user.sellerId, dto);
  }

  // ─── GET /api/assets/:id ─────────────────────────────────────────────────
  /**
   * Returns a single asset by id.
   * Accessible only if owned by this seller or is a platform asset.
   *
   * Auth: seller JWT
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getAsset(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getAsset(user.sellerId, id);
  }
}
