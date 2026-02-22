import { IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export const ORDER_STATUS_VALUES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUS_VALUES)
  status!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().slice(0, 500) : undefined,
  )
  note?: string;
}
