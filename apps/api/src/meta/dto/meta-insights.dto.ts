import { IsIn, IsOptional, IsString } from 'class-validator';

export const META_INSIGHTS_LEVELS = ['campaign', 'adset', 'ad'] as const;
export type MetaInsightsLevel = (typeof META_INSIGHTS_LEVELS)[number];

export class GetMetaInsightsDto {
  /** External Meta entity ID (campaign_id / adset_id / ad_id) */
  @IsString()
  entityId!: string;

  /** Aggregation level */
  @IsIn(META_INSIGHTS_LEVELS)
  level!: MetaInsightsLevel;

  /** Date range start (YYYY-MM-DD), defaults to last 7 days */
  @IsOptional()
  @IsString()
  dateStart?: string;

  /** Date range end (YYYY-MM-DD), defaults to today */
  @IsOptional()
  @IsString()
  dateStop?: string;
}
