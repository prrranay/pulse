import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunityDto } from './dto/communities.dto';
import {
  Community,
  CommunityRole,
  ModerationStatus,
  Prisma,
} from '@prisma/client';
import { PostResponse } from '../posts/posts.service';

export interface CommunityDetailsResponse {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  ownerId: string;
  memberCount: number;
  isMember: boolean;
  role: CommunityRole | null;
}

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserRole(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role;
  }

  private async getPostModerationFilter(
    currentUserId?: string,
  ): Promise<Prisma.PostWhereInput> {
    const role = await this.getUserRole(currentUserId);
    if (role === 'ADMIN' || role === 'MODERATOR') {
      return {};
    }
    if (!currentUserId) {
      return { moderationStatus: ModerationStatus.APPROVED };
    }
    return {
      OR: [
        { moderationStatus: ModerationStatus.APPROVED },
        { authorId: currentUserId, moderationStatus: ModerationStatus.PENDING },
      ],
    };
  }

  async create(ownerId: string, dto: CreateCommunityDto): Promise<Community> {
    const existing = await this.prisma.community.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Community name is already taken');
    }

    // Create community and add owner as member in a transaction
    return this.prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name: dto.name,
          description: dto.description,
          ownerId,
        },
      });

      await tx.communityMember.create({
        data: {
          communityId: community.id,
          userId: ownerId,
          role: CommunityRole.OWNER,
        },
      });

      return community;
    });
  }

  async join(
    userId: string,
    communityId: string,
  ): Promise<{ message: string }> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const membership = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId, userId },
      },
    });

    if (membership) {
      throw new BadRequestException(
        'You are already a member of this community',
      );
    }

    await this.prisma.communityMember.create({
      data: {
        communityId,
        userId,
        role: CommunityRole.MEMBER,
      },
    });

    return { message: 'Joined community successfully' };
  }

  async leave(
    userId: string,
    communityId: string,
  ): Promise<{ message: string }> {
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: { communityId, userId },
      },
    });

    if (!membership) {
      throw new BadRequestException('You are not a member of this community');
    }

    if (membership.role === CommunityRole.OWNER) {
      throw new ConflictException(
        'Owners cannot leave their community. Transfer ownership first.',
      );
    }

    await this.prisma.communityMember.delete({
      where: { id: membership.id },
    });

    return { message: 'Left community successfully' };
  }

  async getDetails(
    communityId: string,
    currentUserId?: string,
  ): Promise<CommunityDetailsResponse> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    let isMember = false;
    let role: CommunityRole | null = null;

    if (currentUserId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: {
          communityId_userId: { communityId, userId: currentUserId },
        },
      });
      if (membership) {
        isMember = true;
        role = membership.role;
      }
    }

    return {
      id: community.id,
      name: community.name,
      description: community.description,
      createdAt: community.createdAt,
      ownerId: community.ownerId,
      memberCount: community._count.members,
      isMember,
      role,
    };
  }

  async getPosts(
    communityId: string,
    currentUserId?: string,
  ): Promise<PostResponse[]> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const postFilter = await this.getPostModerationFilter(currentUserId);

    const posts = await this.prisma.post.findMany({
      where: {
        communityId,
        ...postFilter,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            reposts: true,
          },
        },
      },
    });

    if (posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);

    let likedSet = new Set<string>();
    let bookmarkedSet = new Set<string>();
    let repostedSet = new Set<string>();

    if (currentUserId) {
      const [likes, bookmarks, reposts] = await Promise.all([
        this.prisma.like.findMany({
          where: {
            userId: currentUserId,
            postId: { in: postIds },
          },
          select: { postId: true },
        }),
        this.prisma.bookmark.findMany({
          where: {
            userId: currentUserId,
            postId: { in: postIds },
          },
          select: { postId: true },
        }),
        this.prisma.repost.findMany({
          where: {
            userId: currentUserId,
            postId: { in: postIds },
          },
          select: { postId: true },
        }),
      ]);

      likedSet = new Set(likes.map((l) => l.postId));
      bookmarkedSet = new Set(bookmarks.map((b) => b.postId));
      repostedSet = new Set(reposts.map((r) => r.postId));
    }

    return posts.map((post) => ({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      imagePublicId: post.imagePublicId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
      },
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      repostsCount: post._count.reposts,
      isLiked: likedSet.has(post.id),
      isBookmarked: bookmarkedSet.has(post.id),
      isReposted: repostedSet.has(post.id),
      moderationStatus: post.moderationStatus,
    }));
  }
}
