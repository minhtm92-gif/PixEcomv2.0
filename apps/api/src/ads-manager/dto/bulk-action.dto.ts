import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── BulkStatusDto ────────────────────────────────────────────────────────────

export class BulkStatusDto {
  @IsIn(['campaign', 'adset', 'ad'])
  entityType!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  entityIds!: string[];

  @IsIn(['pause', 'resume'])
  action!: string;
}

// ─── BulkBudgetDto ───────────────────────────────────────────────────────────

export class BulkBudgetDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  campaignIds!: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budget!: number;

  @IsOptional()
  @IsIn(['DAILY', 'LIFETIME'])
  budgetType?: string;
}

// ─── InlineBudgetDto ─────────────────────────────────────────────────────────

export class InlineBudgetDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  budget!: number;

  @IsOptional()
  @IsIn(['DAILY', 'LIFETIME'])
  budgetType?: string;
}
