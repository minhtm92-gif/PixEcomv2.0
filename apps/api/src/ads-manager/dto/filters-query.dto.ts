import { IsOptional, Matches } from 'class-validator';

/** Matches any 8-4-4-4-12 hex string (UUID shape without version check) */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class FiltersQueryDto {
  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'campaignId must be a valid UUID' })
  campaignId?: string;

  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'adsetId must be a valid UUID' })
  adsetId?: string;
}
