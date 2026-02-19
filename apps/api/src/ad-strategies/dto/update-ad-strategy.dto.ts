import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PLACEMENTS,
  PlacementValue,
  StrategyAudienceDto,
  StrategyBudgetDto,
} from './create-ad-strategy.dto';

/**
 * DTO for PATCH /api/fb/ad-strategies/:id
 *
 * All fields optional — at least one must be provided.
 */
export class UpdateAdStrategyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StrategyBudgetDto)
  budget?: StrategyBudgetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StrategyAudienceDto)
  audience?: StrategyAudienceDto;

  @IsOptional()
  @IsIn(PLACEMENTS, { each: true })
  placements?: PlacementValue[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
