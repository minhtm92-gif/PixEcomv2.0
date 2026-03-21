import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkVariantItemDto {
  @IsUUID()
  id!: string;

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

export class BulkUpdateVariantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkVariantItemDto)
  variants!: BulkVariantItemDto[];
}
