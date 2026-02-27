import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BUDGET_TYPES, type BudgetTypeInput } from './create-campaign.dto';

// ─── Per-ad creative config (per-type creative IDs) ─────────────────────────

export class AdCreativeInput {
  @IsIn(['VIDEO_AD', 'IMAGE_AD'])
  adFormat!: 'VIDEO_AD' | 'IMAGE_AD';

  @IsOptional()
  @IsUUID()
  videoId?: string;

  @IsOptional()
  @IsUUID()
  thumbnailId?: string;

  @IsOptional()
  @IsUUID()
  adtextId?: string;

  @IsOptional()
  @IsUUID()
  headlineId?: string;

  @IsOptional()
  @IsUUID()
  descriptionId?: string;
}

// ─── Batch create DTO ────────────────────────────────────────────────────────

export class CreateCampaignBatchDto {
  @IsString()
  @MaxLength(255)
  nameTemplate!: string;

  @IsUUID()
  sellpageId!: string;

  @IsUUID()
  adAccountId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  budget!: number;

  @IsIn(BUDGET_TYPES)
  budgetType!: BudgetTypeInput;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count!: number;

  @IsIn(['ACTIVE', 'PAUSED'])
  initialStatus!: 'ACTIVE' | 'PAUSED';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  adsetsPerCampaign!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  adsPerAdset!: number;

  @IsOptional()
  @IsUUID()
  pageId?: string;

  /** Facebook Pixel connection ID for conversion tracking */
  @IsOptional()
  @IsUUID()
  pixelId?: string;

  /** Audience targeting (geo_locations, age_min, age_max, genders) */
  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdCreativeInput)
  adCreatives?: AdCreativeInput[];
}
