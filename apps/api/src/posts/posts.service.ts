import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto, FeedQueryDto } from './dto/posts.dto';
import { Post, User } from '@prisma/client';

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
}

export interface PaginatedFeedResponse {
  items: PostResponse[];
  nextCursor: string | null;
}

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto): Promise<Post> {
    return this.prisma.post.create({
      data: {
        content: dto.content,
        imageUrl: dto.imageUrl,
        authorId,
      },
    });
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
    };
  }

  async getHomeFeed(
    currentUserId: string,
    query: FeedQueryDto,
  ): Promise<PaginatedFeedResponse> {
    const { cursor, limit } = query;

    // Get followed users
    const followed = await this.prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const authorIds = [currentUserId, ...followed.map((f) => f.followingId)];

    // Fetch posts using cursor-based pagination
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
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

    const enrichedItems = await Promise.all(
      items.map(async (post) => {
        const [like, bookmark, repost] = await Promise.all([
          this.prisma.like.findUnique({
            where: {
              userId_postId: { userId: currentUserId, postId: post.id },
            },
          }),
          this.prisma.bookmark.findUnique({
            where: {
              userId_postId: { userId: currentUserId, postId: post.id },
            },
          }),
          this.prisma.repost.findUnique({
            where: {
              userId_postId: { userId: currentUserId, postId: post.id },
            },
          }),
        ]);

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
          isLiked: !!like,
          isBookmarked: !!bookmark,
          isReposted: !!repost,
        };
      }),
    );

    return {
      items: enrichedItems,
      nextCursor,
    };
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

    return { message: 'Repost removed successfully' };
  }
}
export type { User };
export type { Post };
export type { CreatePostDto };
export type { UpdatePostDto };
export type { FeedQueryDto };
