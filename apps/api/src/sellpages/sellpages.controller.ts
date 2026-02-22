import {
  Body,
  Controller,
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
import { CreateSellpageDto } from './dto/create-sellpage.dto';
import { ListSellpagesDto } from './dto/list-sellpages.dto';
import { UpdateSellpageDto } from './dto/update-sellpage.dto';
import { SellpagesService } from './sellpages.service';
import { IsOptional, IsString } from 'class-validator';

class CheckDomainQueryDto {
  @IsString()
  domain!: string;
}

/**
 * Sellpage management endpoints — seller-scoped.
 *
 * All routes require a valid JWT (JwtAuthGuard).
 * sellerId is ALWAYS sourced from @CurrentUser() — never from a route param.
 * This enforces strict multi-tenant isolation at the controller boundary.
 */
@Controller('sellpages')
@UseGuards(JwtAuthGuard)
export class SellpagesController {
  constructor(private readonly sellpagesService: SellpagesService) {}

  /**
   * POST /api/sellpages
   *
   * Creates a new sellpage for the authenticated seller.
   * Returns 201 Created with the sellpage object.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSellpage(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSellpageDto,
  ) {
    return this.sellpagesService.createSellpage(user.sellerId, dto);
  }

  /**
   * GET /api/sellpages/check-domain?domain=xxx
   * B.1 — Check if a customDomain value is available.
   * Static route — MUST be declared before /:id.
   */
  @Get('check-domain')
  @HttpCode(HttpStatus.OK)
  async checkDomain(@Query() query: CheckDomainQueryDto) {
    return this.sellpagesService.checkDomainAvailability(query.domain);
  }

  /**
   * GET /api/sellpages
   *
   * Returns a paginated list of the authenticated seller's sellpages.
   *
   * Query params:
   *   page   — page number, default 1
   *   limit  — items per page, default 20, max 100
   *   status — filter by status (DRAFT | PUBLISHED | ARCHIVED)
   *   q      — search by slug or titleOverride (case-insensitive)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listSellpages(
    @CurrentUser() user: AuthUser,
    @Query() query: ListSellpagesDto,
  ) {
    return this.sellpagesService.listSellpages(user.sellerId, query);
  }

  /**
   * GET /api/sellpages/:id
   *
   * Returns full sellpage detail including product snapshot.
   * 404 if the sellpage does not exist or belongs to another seller.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSellpage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sellpagesService.getSellpage(user.sellerId, id);
  }

  /**
   * GET /api/sellpages/:id/linked-ads
   *
   * Returns the Campaign → Adset → Ad → AdPost chain for a sellpage.
   * B.3: Enhanced with metrics (last 7 days) + asset details (thumbnailUrl, adText, pageName).
   */
  @Get(':id/linked-ads')
  @HttpCode(HttpStatus.OK)
  async getLinkedAds(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sellpagesService.getLinkedAds(user.sellerId, id);
  }

  /**
   * GET /api/sellpages/:id/pixel
   * B.2 — Return pixel info assigned to this sellpage.
   */
  @Get(':id/pixel')
  @HttpCode(HttpStatus.OK)
  async getPixel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sellpagesService.getPixel(user.sellerId, id);
  }

  /**
   * PATCH /api/sellpages/:id
   *
   * Partial update of a sellpage (slug, domainId, titleOverride, descriptionOverride).
   * At least one field must be provided.
   * 404 if the sellpage does not belong to this seller.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateSellpage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSellpageDto,
  ) {
    return this.sellpagesService.updateSellpage(user.sellerId, id, dto);
  }

  /**
   * POST /api/sellpages/:id/publish
   *
   * Transitions sellpage from DRAFT → PUBLISHED.
   * 400 if already PUBLISHED or ARCHIVED.
   * 404 if not found or belongs to another seller.
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publishSellpage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sellpagesService.publishSellpage(user.sellerId, id);
  }

  /**
   * POST /api/sellpages/:id/unpublish
   *
   * Transitions sellpage from PUBLISHED → DRAFT.
   * 400 if not currently PUBLISHED.
   * 404 if not found or belongs to another seller.
   */
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublishSellpage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sellpagesService.unpublishSellpage(user.sellerId, id);
  }

  /**
   * POST /api/sellpages/:id/verify-domain
   * B.1 — Mock DNS verification. Always returns verified: true in alpha.
   */
  @Post(':id/verify-domain')
  @HttpCode(HttpStatus.OK)
  async verifyDomain(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sellpagesService.verifyDomain(user.sellerId, id);
  }
}
