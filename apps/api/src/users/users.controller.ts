import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  async getProfile(
    @Param('username') username: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.usersService.findByUsername(username, currentUserId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  async follow(
    @CurrentUser('id') followerId: string,
    @Param('id') followingId: string,
  ) {
    return this.usersService.follow(followerId, followingId);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  async unfollow(
    @CurrentUser('id') followerId: string,
    @Param('id') followingId: string,
  ) {
    return this.usersService.unfollow(followerId, followingId);
  }

  @Get(':id/followers')
  @UseGuards(OptionalJwtAuthGuard)
  async getFollowers(
    @Param('id') userId: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.usersService.getFollowers(userId, currentUserId);
  }

  @Get(':id/following')
  @UseGuards(OptionalJwtAuthGuard)
  async getFollowing(
    @Param('id') userId: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.usersService.getFollowing(userId, currentUserId);
  }
}
export type { User } from '@prisma/client';
