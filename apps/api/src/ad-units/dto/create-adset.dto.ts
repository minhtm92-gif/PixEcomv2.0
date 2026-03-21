import { IsJSON, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAdsetDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  optimizationGoal?: string;

  /** JsonB targeting config — any object */
  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;
}
