import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePaymentGatewayDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}
