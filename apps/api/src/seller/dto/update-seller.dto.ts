import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateSellerDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(500)
  logoUrl?: string;
}
