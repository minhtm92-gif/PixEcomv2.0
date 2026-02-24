import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
