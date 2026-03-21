import { IsDateString, IsOptional } from 'class-validator';

export class EmailAnalyticsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class EmailAnalyticsOptionalQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
