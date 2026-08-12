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
import { CurrentUser } from '../common/decorators/user.decorator';
import { JwtService } from '@nestjs/jwt';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Get(':username')
  async getProfile(
    @Param('username') username: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let currentUserId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload: unknown = this.jwtService.decode(token);
        if (payload && typeof payload === 'object') {
          currentUserId = (payload as Record<string, any>).sub as
            string | undefined;
        }
      } catch {
        // Silently fail, user is treated as anonymous
      }
    }

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
  async getFollowers(
    @Param('id') userId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let currentUserId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload: unknown = this.jwtService.decode(token);
        if (payload && typeof payload === 'object') {
          currentUserId = (payload as Record<string, any>).sub as
            string | undefined;
        }
      } catch {
        // anonymous
      }
    }
    return this.usersService.getFollowers(userId, currentUserId);
  }

  @Get(':id/following')
  async getFollowing(
    @Param('id') userId: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let currentUserId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload: unknown = this.jwtService.decode(token);
        if (payload && typeof payload === 'object') {
          currentUserId = (payload as Record<string, any>).sub as
            string | undefined;
        }
      } catch {
        // anonymous
      }
    }
    return this.usersService.getFollowing(userId, currentUserId);
  }
}
export type { User } from '@prisma/client';
