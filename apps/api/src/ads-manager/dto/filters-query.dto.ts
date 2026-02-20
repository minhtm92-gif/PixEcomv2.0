import { IsOptional, IsUUID } from 'class-validator';

export class FiltersQueryDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  adsetId?: string;
}
