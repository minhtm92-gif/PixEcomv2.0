import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type OrderStatusFilter = (typeof ORDER_STATUSES)[number];

export class ListOrdersQueryDto {
  /** Start of date range (createdAt). Defaults to today UTC. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** End of date range (createdAt). Defaults to today UTC. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Filter to a specific sellpage UUID. */
  @IsOptional()
  @IsUUID()
  sellpageId?: string;

  /** Filter by order status. */
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatusFilter;

  /**
   * Free-text search: matches order number (prefix) or customer email (contains).
   * Applied only if provided; max 100 chars to avoid abuse.
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().slice(0, 100) : undefined))
  search?: string;

  /** Max rows per page. Default 20, max 100. */
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /**
   * Opaque cursor for keyset pagination.
   * Format: base64(createdAt.toISOString() + '|' + id)
   * The list endpoint returns nextCursor as this format.
   */
  @IsOptional()
  @IsString()
  cursor?: string;
}
