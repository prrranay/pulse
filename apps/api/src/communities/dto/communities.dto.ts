import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateCommunityDto {
  @IsNotEmpty({ message: 'Community name cannot be empty' })
  @IsString()
  @Length(3, 30, {
    message: 'Community name must be between 3 and 30 characters',
  })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Community name can only contain letters, numbers, underscores, and hyphens',
  })
  name!: string;

  @IsNotEmpty({ message: 'Community description cannot be empty' })
  @IsString()
  @Length(10, 200, {
    message: 'Community description must be between 10 and 200 characters',
  })
  description!: string;
}
