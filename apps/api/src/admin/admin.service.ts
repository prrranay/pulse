import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationStatus } from '@prisma/client';

export interface AdminMetricsResponse {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalComments: number;
  totalCommunities: number;
  totalMessages: number;
  flaggedPosts: number;
}

export interface AnalyticsResponse {
  userGrowth: Array<{ date: string; count: number }>;
  postsPerDay: Array<{ date: string; count: number }>;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<AdminMetricsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalComments,
      totalCommunities,
      totalMessages,
      flaggedPosts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          lastActiveAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.post.count({
        where: {
          moderationStatus: ModerationStatus.APPROVED,
        },
      }),
      this.prisma.comment.count({
        where: {
          moderationStatus: ModerationStatus.APPROVED,
        },
      }),
      this.prisma.community.count(),
      this.prisma.message.count(),
      this.prisma.post.count({
        where: {
          moderationStatus: {
            in: [ModerationStatus.FLAGGED, ModerationStatus.REJECTED],
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalPosts,
      totalComments,
      totalCommunities,
      totalMessages,
      flaggedPosts,
    };
  }

  async listUsers(search?: string, page: number = 1, limit: number = 10) {
    const query = search?.trim();
    const skip = (page - 1) * limit;

    const where = query
      ? {
          OR: [
            { username: { contains: query, mode: 'insensitive' as const } },
            { displayName: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          _count: {
            select: {
              posts: true,
              comments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      users: data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async suspendUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isSuspended: true },
      select: { id: true, username: true, isSuspended: true },
    });
  }

  async unsuspendUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isSuspended: false },
      select: { id: true, username: true, isSuspended: true },
    });
  }

  async listFlaggedContent() {
    const [posts, comments] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          moderationStatus: {
            in: [ModerationStatus.FLAGGED, ModerationStatus.REJECTED],
          },
        },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comment.findMany({
        where: {
          moderationStatus: {
            in: [ModerationStatus.FLAGGED, ModerationStatus.REJECTED],
          },
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      posts: posts.map((p) => ({
        id: p.id,
        type: 'POST',
        content: p.content,
        moderationStatus: p.moderationStatus,
        createdAt: p.createdAt,
        author: {
          username: p.author.username,
          displayName: p.author.displayName,
        },
      })),
      comments: comments.map((c) => ({
        id: c.id,
        type: 'COMMENT',
        content: c.content,
        moderationStatus: c.moderationStatus,
        createdAt: c.createdAt,
        author: {
          username: c.user.username,
          displayName: c.user.displayName,
        },
      })),
    };
  }

  async approveContent(id: string, type: 'POST' | 'COMMENT') {
    if (type === 'POST') {
      const post = await this.prisma.post.findUnique({ where: { id } });
      if (!post) throw new NotFoundException('Post not found');

      // Strip FLAGGED prefix from content if it exists
      const cleanContent = post.content.replace(
        /^\[FLAGGED - SENSITIVE CONTENT\]\s*/i,
        '',
      );

      return this.prisma.post.update({
        where: { id },
        data: {
          moderationStatus: ModerationStatus.APPROVED,
          content: cleanContent,
        },
      });
    } else {
      const comment = await this.prisma.comment.findUnique({ where: { id } });
      if (!comment) throw new NotFoundException('Comment not found');

      const cleanContent = comment.content.replace(
        /^\[FLAGGED - SENSITIVE COMMENT\]\s*/i,
        '',
      );

      return this.prisma.comment.update({
        where: { id },
        data: {
          moderationStatus: ModerationStatus.APPROVED,
          content: cleanContent,
        },
      });
    }
  }

  async rejectContent(id: string, type: 'POST' | 'COMMENT') {
    if (type === 'POST') {
      const post = await this.prisma.post.findUnique({ where: { id } });
      if (!post) throw new NotFoundException('Post not found');

      return this.prisma.post.update({
        where: { id },
        data: {
          moderationStatus: ModerationStatus.REJECTED,
          content: `[REJECTED - VIOLATES GUIDELINES] This post has been removed by safety moderation.`,
        },
      });
    } else {
      const comment = await this.prisma.comment.findUnique({ where: { id } });
      if (!comment) throw new NotFoundException('Comment not found');

      return this.prisma.comment.update({
        where: { id },
        data: {
          moderationStatus: ModerationStatus.REJECTED,
          content: `[REJECTED - VIOLATES GUIDELINES] This comment has been removed by safety moderation.`,
        },
      });
    }
  }

  async getAnalytics(): Promise<AnalyticsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [users, posts] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.post.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          moderationStatus: { not: ModerationStatus.REJECTED },
        },
        select: { createdAt: true },
      }),
    ]);

    // Group user signups by YYYY-MM-DD
    const userGrowthMap = new Map<string, number>();
    users.forEach((u) => {
      const dateStr = u.createdAt.toISOString().slice(0, 10);
      userGrowthMap.set(dateStr, (userGrowthMap.get(dateStr) ?? 0) + 1);
    });

    // Group posts per day by YYYY-MM-DD
    const postsPerDayMap = new Map<string, number>();
    posts.forEach((p) => {
      const dateStr = p.createdAt.toISOString().slice(0, 10);
      postsPerDayMap.set(dateStr, (postsPerDayMap.get(dateStr) ?? 0) + 1);
    });

    // Format maps into sorted arrays
    const userGrowth: Array<{ date: string; count: number }> = [];
    const postsPerDay: Array<{ date: string; count: number }> = [];

    // Pre-populate past 30 days to ensure continuous charts
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);

      userGrowth.push({
        date: dateStr,
        count: userGrowthMap.get(dateStr) ?? 0,
      });

      postsPerDay.push({
        date: dateStr,
        count: postsPerDayMap.get(dateStr) ?? 0,
      });
    }

    return {
      userGrowth,
      postsPerDay,
    };
  }
}
