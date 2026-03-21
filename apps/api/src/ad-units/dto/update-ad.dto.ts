import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const AD_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'] as const;
export type AdStatusInput = (typeof AD_STATUSES)[number];

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(AD_STATUSES)
  status?: AdStatusInput;
}
