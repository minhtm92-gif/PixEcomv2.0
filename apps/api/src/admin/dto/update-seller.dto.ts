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
  paymentGatewayId?: string;
}
