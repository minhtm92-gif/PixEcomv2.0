import { IsDateString, IsOptional } from 'class-validator';

export class SyncRequestDto {
  /**
   * Date to sync in YYYY-MM-DD format.
   * Defaults to today (UTC) if not provided.
   */
  @IsOptional()
  @IsDateString()
  date?: string;
}
