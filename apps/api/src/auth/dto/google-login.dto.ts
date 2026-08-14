import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsNotEmpty({ message: 'ID Token is required' })
  @IsString({ message: 'ID Token must be a string' })
  idToken!: string;
}
