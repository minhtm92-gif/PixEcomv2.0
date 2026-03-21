import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { CAMPAIGN_STATUSES } from '../ads-manager.constants';

export class CampaignsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
