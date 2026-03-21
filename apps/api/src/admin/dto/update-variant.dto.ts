import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  priceOverride?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  fulfillmentCost?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, string>;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  position?: number;
}
