import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateSellerSettingsDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  brandName?: string;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  defaultCurrency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  timezone?: string;

  @IsEmail()
  @IsOptional()
  supportEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  metaPixelId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  googleAnalyticsId?: string;

  @IsBoolean()
  @IsOptional()
  autoTrackingRefresh?: boolean;
}
