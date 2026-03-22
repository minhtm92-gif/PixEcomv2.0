import { IsDateString, IsOptional } from 'class-validator';

export class EmailAnalyticsQueryDto {
<<<<<<< HEAD
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class EmailAnalyticsOptionalQueryDto {
=======
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
