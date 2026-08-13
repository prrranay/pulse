import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto, FeedQueryDto } from './dto/posts.dto';
import { Post, User, ModerationStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../redis/redis.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface AuthorSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface PostResponse {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorSummary;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  isReposted: boolean;
  moderationStatus?: ModerationStatus;
}

export interface PaginatedFeedResponse {
  items: PostResponse[];
  nextCursor: string | null;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly redisService: RedisService,
    @InjectQueue('moderation-queue') private readonly moderationQueue: Queue,
  ) {}

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

  async create(authorId: string, dto: CreatePostDto): Promise<Post> {
    const post = await this.prisma.post.create({
      data: {
        content: dto.content,
        imageUrl: dto.imageUrl,
        authorId,
        communityId: dto.communityId,
      },
    });

    // Enqueue moderation job asynchronously
    await this.moderationQueue
      .add(
        'moderateContent',
        { targetId: post.id, type: 'POST', content: post.content },
        { attempts: 3, backoff: 5000 },
      )
      .catch((err: unknown) => {
        console.error('Failed to enqueue post moderation job:', err);
      });

    // Invalidate user feed cache in Redis
    await this.invalidateUserFeedCache(authorId);

    return post;
  }

  async update(
    postId: string,
    authorId: string,
    dto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== authorId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: dto,
    });
  }

  async delete(postId: string, authorId: string): Promise<{ message: string }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== authorId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }

  async getById(postId: string, currentUserId?: string): Promise<PostResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
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

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const userRole = await this.getUserRole(currentUserId);
    const isAdmin = userRole === 'ADMIN' || userRole === 'MODERATOR';
    const isAuthor = currentUserId === post.authorId;

    if (!isAdmin) {
      if (post.moderationStatus === 'PENDING') {
        if (!isAuthor) {
          throw new NotFoundException('Post not found');
        }
      } else if (
        post.moderationStatus === 'FLAGGED' ||
        post.moderationStatus === 'REJECTED'
      ) {
        throw new NotFoundException('Post not found');
      }
    }

    let isLiked = false;
    let isBookmarked = false;
    let isReposted = false;

    if (currentUserId) {
      const [like, bookmark, repost] = await Promise.all([
        this.prisma.like.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
        this.prisma.bookmark.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
        this.prisma.repost.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
      isReposted = !!repost;
    }

    return {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
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
      isLiked,
      isBookmarked,
      isReposted,
      moderationStatus: post.moderationStatus,
    };
  }

  async getHomeFeed(
    currentUserId: string,
    query: FeedQueryDto,
  ): Promise<PaginatedFeedResponse> {
    const { cursor, limit } = query;
    const cacheKey = `feed:user_${currentUserId}:cursor_${cursor || 'none'}:limit_${limit}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PaginatedFeedResponse;
      }
    } catch (err) {
      console.error('Redis feed cache read failed:', err);
    }

    // Get followed users
    const followed = await this.prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const authorIds = [currentUserId, ...followed.map((f) => f.followingId)];

    const moderationFilter = await this.getPostModerationFilter(currentUserId);

    // Fetch posts using cursor-based pagination
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
        ...moderationFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
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

    let nextCursor: string | null = null;
    const items = [...posts];

    if (items.length > limit) {
      const lastItem = items.pop();
      nextCursor = lastItem ? lastItem.id : null;
    }

    const enrichedItems = await this.enrichPostResponses(items, currentUserId);

    const result = {
      items: enrichedItems,
      nextCursor,
    };

    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), 120); // 2 minutes TTL
    } catch (err) {
      console.error('Redis feed cache write failed:', err);
    }

    return result;
  }

  private async invalidateUserFeedCache(userId: string): Promise<void> {
    try {
      const stream = this.redisService.getClient().scanStream({
        match: `feed:user_${userId}:*`,
        count: 100,
      });

      const keys: string[] = [];
      for await (const resultKeys of stream) {
        keys.push(...(resultKeys as string[]));
      }

      if (keys.length > 0) {
        await this.redisService.getClient().del(...keys);
      }
    } catch (err) {
      console.error(
        `Failed to invalidate feed cache keys for user ${userId}:`,
        err,
      );
    }
  }

  private async enrichPostResponses(
    posts: Array<
      Post & {
        author: User;
        _count: { likes: number; comments: number; reposts: number };
      }
    >,
    currentUserId?: string,
  ): Promise<PostResponse[]> {
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

  async like(userId: string, postId: string): Promise<{ message: string }> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    try {
      await this.prisma.like.create({
        data: { userId, postId },
      });
      // Invalidate cache for the user performing the action
      await this.invalidateUserFeedCache(userId);

      // Trigger notification
      await this.notificationsService.createNotification(
        post.authorId,
        userId,
        'LIKE',
        postId,
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException('Post already liked');
      }
      throw error;
    }

    return { message: 'Post liked successfully' };
  }

  async unlike(userId: string, postId: string): Promise<{ message: string }> {
    const like = await this.prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (!like) {
      throw new BadRequestException('You have not liked this post');
    }

    await this.prisma.like.delete({
      where: { id: like.id },
    });
    // Invalidate cache for the user performing the action
    await this.invalidateUserFeedCache(userId);

    return { message: 'Post unliked successfully' };
  }

  async bookmark(userId: string, postId: string): Promise<{ message: string }> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    try {
      await this.prisma.bookmark.create({
        data: { userId, postId },
      });
      // Invalidate cache for the user performing the action
      await this.invalidateUserFeedCache(userId);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException('Post already bookmarked');
      }
      throw error;
    }

    return { message: 'Post bookmarked successfully' };
  }

  async unbookmark(
    userId: string,
    postId: string,
  ): Promise<{ message: string }> {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (!bookmark) {
      throw new BadRequestException('Post not bookmarked');
    }

    await this.prisma.bookmark.delete({
      where: { id: bookmark.id },
    });
    // Invalidate cache for the user performing the action
    await this.invalidateUserFeedCache(userId);

    return { message: 'Bookmark removed successfully' };
  }

  async repost(userId: string, postId: string): Promise<{ message: string }> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    try {
      await this.prisma.repost.create({
        data: { userId, postId },
      });
      // Invalidate cache for the user performing the action
      await this.invalidateUserFeedCache(userId);

      // Trigger notification
      await this.notificationsService.createNotification(
        post.authorId,
        userId,
        'REPOST',
        postId,
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException('Post already reposted');
      }
      throw error;
    }

    return { message: 'Post reposted successfully' };
  }

  async unrepost(userId: string, postId: string): Promise<{ message: string }> {
    const repost = await this.prisma.repost.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (!repost) {
      throw new BadRequestException('Post not reposted');
    }

    await this.prisma.repost.delete({
      where: { id: repost.id },
    });
    // Invalidate cache for the user performing the action
    await this.invalidateUserFeedCache(userId);

    return { message: 'Repost removed successfully' };
  }

  async getUserPosts(
    username: string,
    currentUserId?: string,
    query?: FeedQueryDto,
  ): Promise<PaginatedFeedResponse> {
    const limit = query?.limit ?? 10;
    const cursor = query?.cursor;

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    const role = await this.getUserRole(currentUserId);
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR';
    const isOwner = currentUserId === user.id;

    let moderationFilter: Prisma.PostWhereInput = {};
    if (!isAdmin) {
      if (isOwner) {
        moderationFilter = {
          moderationStatus: {
            in: [ModerationStatus.APPROVED, ModerationStatus.PENDING],
          },
        };
      } else {
        moderationFilter = {
          moderationStatus: ModerationStatus.APPROVED,
        };
      }
    }

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: user.id,
        ...moderationFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
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

    let nextCursor: string | null = null;
    const items = [...posts];

    if (items.length > limit) {
      const lastItem = items.pop();
      nextCursor = lastItem ? lastItem.id : null;
    }

    const enrichedItems = await this.enrichPostResponses(items, currentUserId);

    return {
      items: enrichedItems,
      nextCursor,
    };
  }

  async getUserReposts(
    username: string,
    currentUserId?: string,
    query?: FeedQueryDto,
  ): Promise<PaginatedFeedResponse> {
    const limit = query?.limit ?? 10;
    const cursor = query?.cursor;

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    const postFilter = await this.getPostModerationFilter(currentUserId);

    const reposts = await this.prisma.repost.findMany({
      where: {
        userId: user.id,
        post: postFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      include: {
        post: {
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
        },
      },
    });

    let nextCursor: string | null = null;
    const items = [...reposts];

    if (items.length > limit) {
      const lastItem = items.pop();
      nextCursor = lastItem ? lastItem.id : null;
    }

    const mappedPosts = items.map((r) => r.post);
    const enrichedItems = await this.enrichPostResponses(
      mappedPosts,
      currentUserId,
    );

    return {
      items: enrichedItems,
      nextCursor,
    };
  }

  async getUserBookmarks(
    username: string,
    currentUserId?: string,
    query?: FeedQueryDto,
  ): Promise<PaginatedFeedResponse> {
    const limit = query?.limit ?? 10;
    const cursor = query?.cursor;

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    if (!currentUserId || user.id !== currentUserId) {
      throw new ForbiddenException('You can only view your own saved posts');
    }

    const postFilter = await this.getPostModerationFilter(currentUserId);

    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        userId: user.id,
        post: postFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      include: {
        post: {
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
        },
      },
    });

    let nextCursor: string | null = null;
    const items = [...bookmarks];

    if (items.length > limit) {
      const lastItem = items.pop();
      nextCursor = lastItem ? lastItem.id : null;
    }

    const mappedPosts = items.map((b) => b.post);
    const enrichedItems = await this.enrichPostResponses(
      mappedPosts,
      currentUserId,
    );

    return {
      items: enrichedItems,
      nextCursor,
    };
  }
}

export type { User };
export type { Post };
export type { CreatePostDto };
export type { UpdatePostDto };
export type { FeedQueryDto };
