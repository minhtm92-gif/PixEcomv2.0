import { IsString, MaxLength } from 'class-validator';

export class CreateAdDto {
  @IsString()
  @MaxLength(255)
  name!: string;
}
