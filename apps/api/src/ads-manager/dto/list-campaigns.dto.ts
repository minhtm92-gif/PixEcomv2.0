import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type CampaignStatusFilter = (typeof CAMPAIGN_STATUSES)[number];

export const SORT_BY_OPTIONS = ['spend', 'roas', 'purchases'] as const;
export type SortByOption = (typeof SORT_BY_OPTIONS)[number];

export const SORT_DIR_OPTIONS = ['asc', 'desc'] as const;
export type SortDirOption = (typeof SORT_DIR_OPTIONS)[number];

export class ListCampaignsQueryDto {
  /** Start of date range for stats aggregation. Defaults to today UTC. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** End of date range for stats aggregation. Defaults to today UTC. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Filter by campaign status. Accepts a single value; default = ACTIVE+PAUSED (both). */
  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatusFilter;

  /** Filter campaigns to a specific sellpage. */
  @IsOptional()
  @IsUUID()
  sellpageId?: string;

  /** Field to sort stats by. Default = spend. */
  @IsOptional()
  @IsIn(SORT_BY_OPTIONS)
  sortBy?: SortByOption;

  /** Sort direction. Default = desc. */
  @IsOptional()
  @IsIn(SORT_DIR_OPTIONS)
  sortDir?: SortDirOption;

  /** Max rows to return. Default = 50, max = 200. */
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** Opaque cursor for pagination (campaign.id of last row in previous page). */
  @IsOptional()
  @IsUUID()
  cursor?: string;

  /** Include ARCHIVED campaigns. Default = false. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
