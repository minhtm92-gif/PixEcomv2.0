import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { CAMPAIGN_STATUSES } from '../ads-manager.constants';

export class AdsQueryDto {
  @IsUUID()
  adsetId!: string;

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
