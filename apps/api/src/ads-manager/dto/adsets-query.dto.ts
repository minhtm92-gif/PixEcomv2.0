import { IsDateString, IsIn, IsOptional, Matches } from 'class-validator';
import { CAMPAIGN_STATUSES } from '../ads-manager.constants';

/** Matches any 8-4-4-4-12 hex string (UUID shape without version check) */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AdsetsQueryDto {
  @Matches(UUID_SHAPE, { message: 'campaignId must be a valid UUID' })
  campaignId!: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: string;
}
