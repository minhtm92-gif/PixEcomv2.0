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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  // ─── POST /api/campaigns ──────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createCampaign(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.service.createCampaign(user.sellerId, dto);
  }

  // ─── POST /api/campaigns/preview ──────────────────────────────────────────
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  previewCampaign(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.service.previewCampaign(user.sellerId, dto);
  }

  // ─── GET /api/campaigns ───────────────────────────────────────────────────
  @Get()
  listCampaigns(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCampaignsDto,
  ) {
    return this.service.listCampaigns(user.sellerId, query);
  }

  // ─── GET /api/campaigns/:id ───────────────────────────────────────────────
  @Get(':id')
  getCampaign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getCampaign(user.sellerId, id);
  }

  // ─── PATCH /api/campaigns/:id/status ─────────────────────────────────────
  @Patch(':id/status')
  updateCampaignStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.service.updateCampaignStatus(user.sellerId, id, dto);
  }
}
