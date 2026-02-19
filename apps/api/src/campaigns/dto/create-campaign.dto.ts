import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const BUDGET_TYPES = ['DAILY', 'LIFETIME'] as const;
export type BudgetTypeValue = (typeof BUDGET_TYPES)[number];

/**
 * DTO for POST /api/campaigns
 *
 * Creates the full Campaign → Adset → Ad → AdPost hierarchy in one request.
 *
 * Required connections (must belong to the seller and be isActive=true):
 *  - adAccountConnectionId: an AD_ACCOUNT type FbConnection
 *  - pageConnectionId: a PAGE type FbConnection (used for AdPost)
 *
 * Optional:
 *  - adStrategyId: if provided, must belong to seller and be isActive=true
 *  - creativeIds: if provided, each creative must belong to seller and be READY
 *  - pixelConnectionId: PIXEL type FbConnection (future use)
 */
export class CreateCampaignDto {
  // ─── Campaign fields ─────────────────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /** Sellpage this campaign promotes. Must belong to the seller. */
  @IsUUID()
  sellpageId!: string;

  /** AD_ACCOUNT type FbConnection. Must belong to seller and be isActive. */
  @IsUUID()
  adAccountConnectionId!: string;

  /** PAGE type FbConnection (used for AdPost delivery). Must belong to seller and be isActive. */
  @IsUUID()
  pageConnectionId!: string;

  /** Optional PIXEL type FbConnection. If provided, must belong to seller and be isActive. */
  @IsOptional()
  @IsUUID()
  pixelConnectionId?: string;

  /**
   * Optional ad strategy. If provided, must belong to seller and be isActive.
   * Budget from the strategy is used to populate the campaign budget.
   */
  @IsOptional()
  @IsUUID()
  adStrategyId?: string;

  /**
   * Campaign budget amount (in cents). Required if adStrategyId is not provided.
   * If both provided, this takes precedence over strategy budget.
   */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100_000_000)
  budgetAmount?: number;

  @IsOptional()
  @IsIn(BUDGET_TYPES)
  budgetType?: BudgetTypeValue;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // ─── Creative links ──────────────────────────────────────────────────────

  /**
   * IDs of READY creatives to attach to this campaign.
   * Each must belong to the seller and have status=READY.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  creativeIds?: string[];

  // ─── Adset / Ad / AdPost config ──────────────────────────────────────────

  /**
   * Name for the generated AdSet. Defaults to "{campaignName} — AdSet 1".
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  adsetName?: string;

  /**
   * Name for the generated Ad. Defaults to "{campaignName} — Ad 1".
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  adName?: string;
}
