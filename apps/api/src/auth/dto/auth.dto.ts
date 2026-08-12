import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'Username can only contain alphanumeric characters and underscores',
  })
  username!: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @IsString({ message: 'Display name must be a string' })
  @IsOptional()
  displayName?: string;
}

export class LoginDto {
  @IsNotEmpty({ message: 'Email or Username is required' })
  @IsString()
  usernameOrEmail!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password!: string;
}
