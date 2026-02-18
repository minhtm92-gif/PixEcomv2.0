import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

enum SellpageStatusFilter {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Query params for GET /api/sellpages
 *
 *   page   — page number, default 1
 *   limit  — items per page, default 20, max 100
 *   status — filter by status (DRAFT | PUBLISHED | ARCHIVED)
 *   q      — search by titleOverride or slug (case-insensitive)
 */
export class ListSellpagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SellpageStatusFilter)
  status?: SellpageStatusFilter;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
}
