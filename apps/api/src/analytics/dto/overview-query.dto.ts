import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Query DTO for GET /api/analytics/overview
 *
 * All params are optional. Defaults applied in service:
 *   dateFrom / dateTo — today UTC
 *   includeSources   — ['META']
 *   timezone         — 'UTC' (no conversion in Phase 1 MVP)
 */
export class OverviewQueryDto {
  /** Start of date range (YYYY-MM-DD). Defaults to today UTC. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** End of date range (YYYY-MM-DD). Defaults to today UTC. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Filter to a specific sellpage UUID. */
  @IsOptional()
  @IsUUID()
  sellpageId?: string;

  /**
   * Comma-separated ad sources to include in cost aggregation.
   * Default: META. Future: GOOGLE, TIKTOK.
   * Transformed to string[] before validation.
   */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s: string) => s.trim().toUpperCase())
          .filter(Boolean)
      : value,
  )
  includeSources?: string[];

  /**
   * IANA timezone string (e.g. 'Asia/Ho_Chi_Minh').
   * Accepted but NOT applied in Phase 1 MVP — all aggregation uses UTC.
   */
  @IsOptional()
  @IsString()
  timezone?: string;
}
