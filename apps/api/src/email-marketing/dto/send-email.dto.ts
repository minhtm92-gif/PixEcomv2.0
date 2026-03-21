import { IsString, IsOptional, IsInt, IsDateString, IsObject, Min, Max } from 'class-validator';

export class SendEmailDto {
  @IsString()
  toEmail!: string;

  @IsOptional()
  @IsString()
  toName?: string;

  @IsString()
  flowId!: string;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  priority?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
