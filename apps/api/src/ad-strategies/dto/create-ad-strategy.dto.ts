import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Budget config ────────────────────────────────────────────────────────────

export const BUDGET_TYPES = ['DAILY', 'LIFETIME'] as const;
export type BudgetTypeValue = (typeof BUDGET_TYPES)[number];

export const AUDIENCE_MODES = ['ADVANTAGE_PLUS', 'MANUAL'] as const;
export type AudienceModeValue = (typeof AUDIENCE_MODES)[number];

export const PLACEMENTS = [
  'FACEBOOK_FEED',
  'INSTAGRAM_FEED',
  'FACEBOOK_REELS',
  'INSTAGRAM_REELS',
  'AUDIENCE_NETWORK',
] as const;
export type PlacementValue = (typeof PLACEMENTS)[number];

export class StrategyBudgetDto {
  @IsIn(BUDGET_TYPES)
  budgetType!: BudgetTypeValue;

  /**
   * Budget amount in the seller's currency (minor units — cents).
   * Min 100 cents ($1.00), max 100_000_000 cents ($1,000,000).
   */
  @IsInt()
  @Min(100)
  @Max(100_000_000)
  amount!: number;
}

export class StrategyAudienceDto {
  @IsIn(AUDIENCE_MODES)
  mode!: AudienceModeValue;

  /**
   * Attribution window in days (1, 7, 28).
   * Only validated when mode = MANUAL.
   */
  @IsOptional()
  @IsInt()
  @IsIn([1, 7, 28])
  attributionWindowDays?: number;
}

/**
 * DTO for POST /api/fb/ad-strategies
 *
 * Stores a reusable campaign strategy template.
 * The `config` JSON is structured and validated here.
 */
export class CreateAdStrategyDto {
  /** Human-readable name for this strategy */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /** Budget configuration */
  @IsDefined()
  @ValidateNested()
  @Type(() => StrategyBudgetDto)
  budget!: StrategyBudgetDto;

  /** Audience targeting mode */
  @IsDefined()
  @ValidateNested()
  @Type(() => StrategyAudienceDto)
  audience!: StrategyAudienceDto;

  /**
   * Ad placements — at least one required.
   * Each value must be a known placement string.
   */
  @IsDefined()
  @IsIn(PLACEMENTS, { each: true })
  placements!: PlacementValue[];

  /** Whether this strategy is active (usable when creating campaigns). */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
