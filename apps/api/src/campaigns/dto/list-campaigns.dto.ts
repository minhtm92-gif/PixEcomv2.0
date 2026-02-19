import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export const CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'] as const;
export type CampaignStatusValue = (typeof CAMPAIGN_STATUSES)[number];

/**
 * Query params for GET /api/campaigns
 */
export class ListCampaignsDto {
  /** Filter by campaign status */
  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatusValue;

  /** Filter by sellpage */
  @IsOptional()
  @IsUUID()
  sellpageId?: string;

  /**
   * Include ARCHIVED/DELETED campaigns.
   * Default: false — returns only ACTIVE and PAUSED.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
