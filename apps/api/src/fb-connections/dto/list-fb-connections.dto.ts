import { IsIn, IsOptional } from 'class-validator';
import { FB_CONNECTION_TYPES, FbConnectionTypeValue } from './create-fb-connection.dto';

/**
 * Query params for GET /api/fb/connections
 */
export class ListFbConnectionsDto {
  /** Filter by connection type (optional) */
  @IsOptional()
  @IsIn(FB_CONNECTION_TYPES)
  connectionType?: FbConnectionTypeValue;
}
