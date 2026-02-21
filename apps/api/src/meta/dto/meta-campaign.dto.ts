import { IsIn, IsOptional, IsString } from 'class-validator';

export const META_CAMPAIGN_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'DELETED',
  'ARCHIVED',
] as const;

export class GetMetaCampaignInsightsDto {
  /** The external Meta campaign ID */
  @IsString()
  campaignId!: string;

  /** Date range start (YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  dateStart?: string;

  /** Date range end (YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  dateStop?: string;

  /** Status filter */
  @IsOptional()
  @IsIn(META_CAMPAIGN_STATUSES)
  status?: (typeof META_CAMPAIGN_STATUSES)[number];
}
