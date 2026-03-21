import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  value!: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  usageLimit?: number;

  @IsOptional()
  @IsUUID()
  sellpageId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
