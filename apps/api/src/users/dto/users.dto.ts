import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Display name cannot exceed 50 characters' })
  displayName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160, { message: 'Bio cannot exceed 160 characters' })
  bio?: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL for the avatar' })
  avatarUrl?: string;
}
