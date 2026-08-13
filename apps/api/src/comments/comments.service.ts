import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, CommentQueryDto } from './dto/comments.dto';
import { Comment, ModerationStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface AuthorSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ReplyResponse {
  id: string;
  content: string;
  createdAt: Date;
  author: AuthorSummary;
  moderationStatus?: string;
}

export interface CommentResponse {
  id: string;
  content: string;
  createdAt: Date;
  author: AuthorSummary;
  replies: ReplyResponse[];
  moderationStatus?: string;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
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

  private async getCommentModerationFilter(
    currentUserId?: string,
  ): Promise<Prisma.CommentWhereInput> {
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
        { userId: currentUserId, moderationStatus: ModerationStatus.PENDING },
      ],
    };
  }

  async createComment(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        userId,
        postId,
      },
    });

    await this.notificationsService.createNotification(
      post.authorId,
      userId,
      'COMMENT',
      postId,
      comment.id,
    );

    // Enqueue comment moderation job asynchronously
    await this.moderationQueue
      .add(
        'moderateContent',
        { targetId: comment.id, type: 'COMMENT', content: comment.content },
        { attempts: 3, backoff: 5000 },
      )
      .catch((err: unknown) => {
        console.error('Failed to enqueue comment moderation job:', err);
      });

    return comment;
  }

  async createReply(
    userId: string,
    parentCommentId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const parentComment = await this.prisma.comment.findUnique({
      where: { id: parentCommentId },
    });

    if (!parentComment) {
      throw new NotFoundException('Parent comment not found');
    }

    const reply = await this.prisma.comment.create({
      data: {
        content: dto.content,
        userId,
        postId: parentComment.postId,
        parentId: parentCommentId,
      },
    });

    await this.notificationsService.createNotification(
      parentComment.userId,
      userId,
      'REPLY',
      parentComment.postId,
      reply.id,
    );

    // Enqueue reply moderation job asynchronously
    await this.moderationQueue
      .add(
        'moderateContent',
        { targetId: reply.id, type: 'COMMENT', content: reply.content },
        { attempts: 3, backoff: 5000 },
      )
      .catch((err: unknown) => {
        console.error('Failed to enqueue reply moderation job:', err);
      });

    return reply;
  }

  async getComments(
    postId: string,
    query: CommentQueryDto,
    currentUserId?: string,
  ): Promise<CommentResponse[]> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;
    const filter = await this.getCommentModerationFilter(currentUserId);

    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // Only fetch top-level comments
        ...filter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        user: true,
        replies: {
          where: filter, // Filter replies as well!
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            user: true,
          },
        },
      },
    });

    return comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: {
        id: c.user.id,
        username: c.user.username,
        displayName: c.user.displayName,
        avatarUrl: c.user.avatarUrl,
      },
      replies: c.replies.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        author: {
          id: r.user.id,
          username: r.user.username,
          displayName: r.user.displayName,
          avatarUrl: r.user.avatarUrl,
        },
        moderationStatus: r.moderationStatus,
      })),
      moderationStatus: c.moderationStatus,
    }));
  }
}
