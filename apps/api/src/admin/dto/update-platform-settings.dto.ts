import { IsOptional, IsString } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  platformName?: string;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  smtpConfig?: Record<string, unknown>;

  @IsOptional()
  smsConfig?: Record<string, unknown>;

  @IsOptional()
  legalPages?: Record<string, unknown>;

  @IsOptional()
  billingConfig?: Record<string, unknown>;
}
