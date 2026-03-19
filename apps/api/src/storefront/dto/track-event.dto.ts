import { IsString, IsOptional, IsNumber } from 'class-validator';

export class TrackEventDto {
  @IsString()
  event!: string;

  @IsString()
  sellpageSlug!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;
}
