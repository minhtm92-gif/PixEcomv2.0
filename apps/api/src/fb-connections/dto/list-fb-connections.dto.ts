import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { FB_CONNECTION_TYPES, FbConnectionTypeValue } from './create-fb-connection.dto';

/**
 * Query params for GET /api/fb/connections
 */
export class ListFbConnectionsDto {
  /** Filter by connection type (optional) */
  @IsOptional()
  @IsIn(FB_CONNECTION_TYPES)
  connectionType?: FbConnectionTypeValue;

  /**
   * Include inactive (soft-deleted) connections.
   * Default: false — only active connections returned.
   * Pass ?includeInactive=true to include disabled connections.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
