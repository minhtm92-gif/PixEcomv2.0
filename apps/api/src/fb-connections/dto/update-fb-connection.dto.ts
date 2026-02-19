import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for PATCH /api/fb/connections/:id
 *
 * All fields optional — at least one must be provided (validated in service).
 * connectionType and externalId are immutable after creation.
 * parentId is immutable after creation.
 */
export class UpdateFbConnectionDto {
  /** Update display name */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  /** Toggle primary status for this connection type */
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  /** Toggle active/disabled status */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
