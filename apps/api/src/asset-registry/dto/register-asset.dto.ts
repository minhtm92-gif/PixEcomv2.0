import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
  IsIn,
  IsInt,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for POST /api/assets (seller self-registers after upload)
 */
export class RegisterAssetDto {
  /** Public CDN URL of the uploaded asset */
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  url!: string;

  /** R2 storage key (optional; stored for internal reference) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  /** Media type of the asset */
  @IsIn(['VIDEO', 'IMAGE', 'TEXT'])
  mediaType!: 'VIDEO' | 'IMAGE' | 'TEXT';

  /** MIME type (optional) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  /** File size in bytes (optional) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSizeBytes?: number;

  /** Duration in seconds for videos (optional) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  durationSec?: number;

  /** Width in pixels (optional) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  width?: number;

  /** Height in pixels (optional) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  height?: number;

  /**
   * SHA-256 hex checksum of the file.
   * Used for de-duplication: same owner + same checksum → returns existing.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksum?: string;

  /** Optional external ID for idempotent re-registration (sourceType=USER_UPLOAD) */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ingestionId?: string;

  /** Arbitrary metadata blob (e.g. { content: '...' } for TEXT assets) */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
