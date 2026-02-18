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
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for POST /api/assets/ingest (API-key / superadmin only)
 * Used by internal ingestion pipelines (PIXCON sync, partner API, migration).
 */
export class IngestAssetDto {
  /**
   * Source pipeline that produced this asset.
   * Determines the ingestion_id namespace for de-dup.
   */
  @IsIn(['PIXCON', 'PARTNER_API', 'MIGRATION', 'SYSTEM'])
  sourceType!: 'PIXCON' | 'PARTNER_API' | 'MIGRATION' | 'SYSTEM';

  /**
   * External unique ID within the source pipeline.
   * Combined with sourceType for idempotent ingestion.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ingestionId?: string;

  /** Media type of the asset */
  @IsIn(['VIDEO', 'IMAGE', 'TEXT'])
  mediaType!: 'VIDEO' | 'IMAGE' | 'TEXT';

  /** Public URL of the asset */
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  url!: string;

  /** R2 storage key (optional) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

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

  /** SHA-256 hex checksum (optional, used for de-dup) */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksum?: string;

  /**
   * Owner seller ID.
   * If omitted → platform asset (ownerSellerId=null, visible to all sellers).
   */
  @IsOptional()
  @IsUUID()
  ownerSellerId?: string;

  /** Arbitrary metadata for the ingested asset */
  @IsOptional()
  metadata?: Record<string, unknown>;
}
