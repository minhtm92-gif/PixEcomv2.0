import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Query params for GET /api/fb/ad-strategies
 */
export class ListAdStrategiesDto {
  /**
   * Include inactive (soft-deleted) strategies.
   * Default: false — only active strategies returned.
   * Pass ?includeInactive=true to include disabled strategies.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
