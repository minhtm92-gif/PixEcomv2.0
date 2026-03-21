import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export const ADSET_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'] as const;
export type AdsetStatusInput = (typeof ADSET_STATUSES)[number];

export class UpdateAdsetDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  optimizationGoal?: string;

  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;

  @IsOptional()
  @IsIn(ADSET_STATUSES)
  status?: AdsetStatusInput;
}
