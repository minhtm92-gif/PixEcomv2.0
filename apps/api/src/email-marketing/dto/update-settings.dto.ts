import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  replyToEmail?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  minHoursBetweenEmails?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxEmailsPerWeek?: number;
}
