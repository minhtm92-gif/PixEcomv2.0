import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AdminFbConnectionsQueryDto {
  @IsOptional()
  @IsEnum(['AD_ACCOUNT', 'PAGE', 'PIXEL', 'CONVERSION'])
  connectionType?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().slice(0, 100) : undefined,
  )
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? parseInt(value, 10) : undefined,
  )
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? parseInt(value, 10) : undefined,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
