import {
  IsDecimal,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export const BUDGET_TYPES = ['DAILY', 'LIFETIME'] as const;
export type BudgetTypeInput = (typeof BUDGET_TYPES)[number];

export class CreateCampaignDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsUUID()
  sellpageId!: string;

  @IsUUID()
  adAccountId!: string;

  @IsOptional()
  @IsUUID()
  adStrategyId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  budget!: number;

  @IsIn(BUDGET_TYPES)
  budgetType!: BudgetTypeInput;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
