import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const CAMPAIGN_STATUS_FILTERS = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'] as const;
export type CampaignStatusFilter = (typeof CAMPAIGN_STATUS_FILTERS)[number];

export class ListCampaignsDto {
  @IsOptional()
  @IsUUID()
  sellpageId?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUS_FILTERS)
  status?: CampaignStatusFilter;

  /** Keyset pagination cursor (base64url encoded) */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
