import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const POST_SOURCES = ['EXISTING', 'CONTENT_SOURCE'] as const;
export type PostSourceInput = (typeof POST_SOURCES)[number];

export class CreateAdPostDto {
  /** Internal UUID of FbConnection type=PAGE belonging to seller */
  @IsUUID()
  pageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalPostId?: string;

  @IsIn(POST_SOURCES)
  postSource!: PostSourceInput;

  @IsOptional()
  @IsUUID()
  assetMediaId?: string;

  @IsOptional()
  @IsUUID()
  assetThumbnailId?: string;

  @IsOptional()
  @IsUUID()
  assetAdtextId?: string;
}
