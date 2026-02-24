import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStoreDto {
  @IsUUID()
  sellerId!: string;

  @IsString()
  @IsNotEmpty()
  hostname!: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;
}
