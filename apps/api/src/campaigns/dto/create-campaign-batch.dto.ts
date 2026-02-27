import {
  IsIn,
  IsInt,
  IsNumber,
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

// ─── Per-ad creative input ──────────────────────────────────────────────────

export class AdCreativeInput {
  @IsIn(['EXISTING', 'CONTENT_SOURCE'])
  sourceType!: 'EXISTING' | 'CONTENT_SOURCE';

  @IsIn(['VIDEO', 'IMAGE'])
  mediaType!: 'VIDEO' | 'IMAGE';

  @IsOptional()
  @IsString()
  externalPostId?: string;

  @IsOptional()
  @IsString()
  adText?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
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

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdCreativeInput)
  adCreatives?: AdCreativeInput[];
}
