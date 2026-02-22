import { IsOptional, IsUUID } from 'class-validator';

export class FiltersQueryDto {
  @IsOptional()
  @IsUUID('all')
  campaignId?: string;

  @IsOptional()
  @IsUUID('all')
  adsetId?: string;
}
