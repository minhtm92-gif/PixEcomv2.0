import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSellerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  paypalGatewayId?: string;

  @IsOptional()
  @IsUUID()
  creditCardGatewayId?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;
}
