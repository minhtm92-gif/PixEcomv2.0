import { IsDateString, IsOptional } from 'class-validator';

export class EmailAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
