import { IsEmail, IsString, MinLength } from 'class-validator';

export class TrackOrderQueryDto {
  @IsString()
  @MinLength(1)
  orderNumber!: string;

  @IsEmail()
  email!: string;
}
