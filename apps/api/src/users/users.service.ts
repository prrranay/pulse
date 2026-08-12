import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/users.dto';
import { User } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

export interface UserProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  followersCount: number;
  followingCount: number;
  postCount: number;
  isFollowing?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByUsername(
    username: string,
    currentUserId?: string,
  ): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    // Get follower/following counts
    const [followersCount, followingCount, postCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      this.prisma.post.count({ where: { authorId: user.id } }),
    ]);

    let isFollowing = false;
    if (currentUserId) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      followersCount,
      followingCount,
      postCount,
      isFollowing,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    const result = { ...user } as Record<string, any>;
    delete result.password;
    return result as Omit<User, 'password'>;
  }

  async follow(
    followerId: string,
    followingId: string,
  ): Promise<{ message: string }> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const followingUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!followingUser) {
      throw new NotFoundException('User to follow not found');
    }

    try {
      await this.prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
      });
      // Trigger notification
      await this.notificationsService.createNotification(
        followingId,
        followerId,
        'FOLLOW',
      );
    } catch (error: unknown) {
      const err = error as Record<string, any>;
      // Prisma P2002 error code is for unique constraint violation
      if (err?.code === 'P2002') {
        throw new ConflictException('You are already following this user');
      }
      throw error;
    }

    return { message: `Successfully followed @${followingUser.username}` };
  }

  async unfollow(
    followerId: string,
    followingId: string,
  ): Promise<{ message: string }> {
    const followingUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!followingUser) {
      throw new NotFoundException('User to unfollow not found');
    }

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new BadRequestException('You are not following this user');
    }

    await this.prisma.follow.delete({
      where: {
        id: follow.id,
      },
    });

    return { message: `Successfully unfollowed @${followingUser.username}` };
  }

  async getFollowers(
    userId: string,
    currentUserId?: string,
  ): Promise<Array<Omit<User, 'password'> & { isFollowing?: boolean }>> {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: true,
      },
    });

    const followers = follows.map((f) => f.follower);

    return this.mapUsersWithFollowingStatus(followers, currentUserId);
  }

  async getFollowing(
    userId: string,
    currentUserId?: string,
  ): Promise<Array<Omit<User, 'password'> & { isFollowing?: boolean }>> {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userExists) {
      throw new NotFoundException('User not found');
    }

    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: true,
      },
    });

    const following = follows.map((f) => f.following);

    return this.mapUsersWithFollowingStatus(following, currentUserId);
  }

  private async mapUsersWithFollowingStatus(
    users: User[],
    currentUserId?: string,
  ): Promise<Array<Omit<User, 'password'> & { isFollowing?: boolean }>> {
    if (!currentUserId || users.length === 0) {
      return users.map((u) => {
        const result = { ...u } as Record<string, any>;
        delete result.password;
        return {
          ...(result as Omit<User, 'password'>),
          isFollowing: false,
        };
      });
    }

    // Check which users the current user is following
    const userIdsToCheck = users.map((u) => u.id);
    const activeFollows = await this.prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: userIdsToCheck },
      },
    });

    const followingSet = new Set(activeFollows.map((f) => f.followingId));

    return users.map((u) => {
      const result = { ...u } as Record<string, any>;
      delete result.password;
      return {
        ...(result as Omit<User, 'password'>),
        isFollowing: followingSet.has(u.id),
      };
    });
  }
}
export type { User };
