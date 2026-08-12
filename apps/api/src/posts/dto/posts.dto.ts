import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePostDto {
  @IsNotEmpty({ message: 'Post content cannot be empty' })
  @IsString()
  content!: string;

  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL for the image' })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  communityId?: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL for the image' })
  imageUrl?: string;
}

export class FeedQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit: number = 10;
}
