import { IsString, IsNotEmpty, MaxLength, IsIn } from 'class-validator';

/**
 * Body for POST /api/assets/signed-upload
 * Seller provides filename + contentType; API returns presigned PUT URL.
 */
export class SignedUploadDto {
  /** Original filename (used to build the storage key suffix) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  /** MIME type of the file being uploaded */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType!: string;

  /** Declared media type — determines how the asset is categorised */
  @IsIn(['VIDEO', 'IMAGE', 'TEXT'])
  mediaType!: 'VIDEO' | 'IMAGE' | 'TEXT';
}
