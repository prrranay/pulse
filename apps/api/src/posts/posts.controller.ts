import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto, FeedQueryDto } from './dto/posts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @RateLimit(20, 60)
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(userId, dto);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async getFeed(
    @CurrentUser('id') userId: string,
    @Query() query: FeedQueryDto,
  ) {
    return this.postsService.getHomeFeed(userId, query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getById(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.postsService.getById(id, currentUserId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.postsService.delete(id, userId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async like(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.postsService.like(userId, id);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unlike(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.postsService.unlike(userId, id);
  }

  @Post(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bookmark(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.postsService.bookmark(userId, id);
  }

  @Delete(':id/bookmark')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unbookmark(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.postsService.unbookmark(userId, id);
  }

  @Post(':id/repost')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async repost(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.postsService.repost(userId, id);
  }

  @Delete(':id/repost')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unrepost(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.postsService.unrepost(userId, id);
  }

  @Get('user/:username')
  @UseGuards(OptionalJwtAuthGuard)
  async getUserPosts(
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.postsService.getUserPosts(username, currentUserId, query);
  }

  @Get('user/:username/reposts')
  @UseGuards(OptionalJwtAuthGuard)
  async getUserReposts(
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.postsService.getUserReposts(username, currentUserId, query);
  }

  @Get('user/:username/bookmarks')
  @UseGuards(JwtAuthGuard)
  async getUserBookmarks(
    @Param('username') username: string,
    @Query() query: FeedQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.postsService.getUserBookmarks(username, userId, query);
  }
}
export type { User } from '@prisma/client';
export type { CreatePostDto };
