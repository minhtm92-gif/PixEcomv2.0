import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  productCode?: string;

  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  price!: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
