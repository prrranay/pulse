import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostResponse } from '../posts/posts.service';
import { Post, User, ModerationStatus, Prisma } from '@prisma/client';

export interface SearchResultsResponse {
  users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  posts: PostResponse[];
  communities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface ExploreDataResponse {
  trendingPosts: PostResponse[];
  suggestedUsers: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  }>;
  popularCommunities: Array<{
    id: string;
    name: string;
    description: string;
    memberCount: number;
  }>;
  recentPosts: PostResponse[];
}

@Injectable()
export class DiscoveryService {
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

  async searchAll(
    q: string,
    currentUserId?: string,
  ): Promise<SearchResultsResponse> {
    const query = q.trim();
    if (!query) {
      return { users: [], posts: [], communities: [] };
    }

    const postFilter = await this.getPostModerationFilter(currentUserId);

    const [users, posts, communities] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
        take: 20,
      }),
      this.prisma.post.findMany({
        where: {
          content: { contains: query, mode: 'insensitive' },
          ...postFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
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
      }),
      this.prisma.community.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        take: 20,
      }),
    ]);

    // Enrich search posts with interaction flags
    const enrichedPosts = await this.enrichPosts(posts, currentUserId);

    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      })),
      posts: enrichedPosts,
      communities,
    };
  }

  async getExploreData(currentUserId?: string): Promise<ExploreDataResponse> {
    const postFilter = await this.getPostModerationFilter(currentUserId);

    // 1. Trending Posts (Past 7 days, sorted by gravity score)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const candidatePosts = await this.prisma.post.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        ...postFilter,
      },
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

    const now = new Date().getTime();
    const scoredPosts = candidatePosts.map((post) => {
      const likes = post._count.likes;
      const comments = post._count.comments;
      const reposts = post._count.reposts;

      const timeElapsedHours = Math.max(
        0.1,
        (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60),
      );

      // Hacker News type gravity-based decay formula:
      // score = (likes * 2 + comments * 3 + reposts * 4) / ((hours_elapsed + 2) ^ 1.5)
      const score =
        (likes * 2 + comments * 3 + reposts * 4) /
        Math.pow(timeElapsedHours + 2, 1.5);

      return { post, score };
    });

    // Sort by score desc, take top 10
    const trendingCandidates = scoredPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((sp) => sp.post);

    const trendingPosts = await this.enrichPosts(
      trendingCandidates,
      currentUserId,
    );

    // 2. Recent Posts
    const recentPostsList = await this.prisma.post.findMany({
      where: postFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
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

    const recentPosts = await this.enrichPosts(recentPostsList, currentUserId);

    // 3. Suggested Users (Top followed users, excluding already followed + self)
    let followedUserIds: string[] = [];
    if (currentUserId) {
      const followed = await this.prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      followedUserIds = [currentUserId, ...followed.map((f) => f.followingId)];
    }

    const suggestedUsers = await this.prisma.user.findMany({
      where: currentUserId ? { id: { notIn: followedUserIds } } : undefined,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: {
          select: { followers: true },
        },
      },
      orderBy: {
        followers: { _count: 'desc' },
      },
      take: 5,
    });

    // 4. Popular Communities (Sorted by member count desc)
    const popularCommunities = await this.prisma.community.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        members: { _count: 'desc' },
      },
      take: 5,
    });

    return {
      trendingPosts,
      suggestedUsers: suggestedUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      })),
      popularCommunities: popularCommunities.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        memberCount: c._count.members,
      })),
      recentPosts,
    };
  }

  private async enrichPosts(
    posts: Array<
      Post & {
        author: User;
        _count?: { likes?: number; comments?: number; reposts?: number } | null;
      }
    >,
    currentUserId?: string,
  ): Promise<PostResponse[]> {
    return Promise.all(
      posts.map(async (post) => {
        let isLiked = false;
        let isBookmarked = false;
        let isReposted = false;

        if (currentUserId) {
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
          likesCount: post._count?.likes ?? 0,
          commentsCount: post._count?.comments ?? 0,
          repostsCount: post._count?.reposts ?? 0,
          isLiked,
          isBookmarked,
          isReposted,
          moderationStatus: post.moderationStatus,
        };
      }),
    );
  }
}
