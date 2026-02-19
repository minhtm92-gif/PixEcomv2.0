import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Connection types supported by the platform.
 * Only META for Phase 1 — enum is forward-compatible.
 */
export const CONNECTION_PROVIDERS = ['META'] as const;
export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

/**
 * Supported FB connection types (mirrors FbConnectionType enum).
 */
export const FB_CONNECTION_TYPES = [
  'AD_ACCOUNT',
  'PAGE',
  'PIXEL',
  'CONVERSION',
] as const;
export type FbConnectionTypeValue = (typeof FB_CONNECTION_TYPES)[number];

/**
 * DTO for POST /api/fb/connections
 *
 * Stores connection metadata only.
 * No access_token is accepted or stored in Phase 2.3.1.
 */
export class CreateFbConnectionDto {
  /** Facebook connection type */
  @IsIn(FB_CONNECTION_TYPES)
  connectionType!: FbConnectionTypeValue;

  /** Facebook-issued external ID (ad account ID, page ID, pixel ID, etc.) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalId!: string;

  /** Human-readable display name / label for this connection */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /**
   * Parent connection ID (e.g. a PAGE connection can be parented to an AD_ACCOUNT).
   * Optional — top-level connections have no parent.
   */
  @IsOptional()
  @IsUUID()
  parentId?: string;

  /** Whether this is the primary connection for its type within this seller. */
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
