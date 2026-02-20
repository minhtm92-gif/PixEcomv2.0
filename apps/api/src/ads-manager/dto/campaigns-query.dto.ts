import { IsDateString, IsIn, IsOptional } from 'class-validator';
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
}
