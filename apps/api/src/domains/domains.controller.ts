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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { VerifyDomainDto } from './dto/verify-domain.dto';
import { DomainsService } from './domains.service';

/**
 * Seller domain management endpoints.
 *
 * All routes require a valid JWT (JwtAuthGuard).
 * sellerId is ALWAYS sourced from @CurrentUser() — never from route param.
 * This enforces strict multi-tenant isolation at the controller boundary.
 */
@Controller('domains')
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  /**
   * POST /api/domains
   *
   * Registers a new custom domain for the seller.
   * Normalizes and validates the hostname.
   * Returns 201 with the domain + verification record.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDomain(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDomainDto,
  ) {
    return this.domainsService.createDomain(user.sellerId, dto);
  }

  /**
   * GET /api/domains
   *
   * Returns all domains for the authenticated seller.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listDomains(@CurrentUser() user: AuthUser) {
    return this.domainsService.listDomains(user.sellerId);
  }

  /**
   * PATCH /api/domains/:id
   *
   * Updates domain properties (currently: isPrimary).
   * Setting isPrimary=true unsets previous primary in a transaction.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateDomain(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDomainDto,
  ) {
    return this.domainsService.updateDomain(user.sellerId, id, dto);
  }

  /**
   * DELETE /api/domains/:id
   *
   * Deletes a domain.
   * Returns 409 if the domain is currently attached to a sellpage.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteDomain(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.domainsService.deleteDomain(user.sellerId, id);
  }

  /**
   * POST /api/domains/:id/verify
   *
   * Phase 1 stub — marks domain as VERIFIED when body contains { force: true }.
   * Phase 2 will perform a real DNS TXT lookup.
   */
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verifyDomain(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDomainDto,
  ) {
    return this.domainsService.verifyDomain(user.sellerId, id, dto);
  }
}
