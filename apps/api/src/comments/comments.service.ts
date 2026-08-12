import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, CommentQueryDto } from './dto/comments.dto';
import { Comment } from '@prisma/client';

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
}

export interface CommentResponse {
  id: string;
  content: string;
  createdAt: Date;
  author: AuthorSummary;
  replies: ReplyResponse[];
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createComment(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.comment.create({
      data: {
        content: dto.content,
        userId,
        postId,
      },
    });
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

    return this.prisma.comment.create({
      data: {
        content: dto.content,
        userId,
        postId: parentComment.postId,
        parentId: parentCommentId,
      },
    });
  }

  async getComments(
    postId: string,
    query: CommentQueryDto,
  ): Promise<CommentResponse[]> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // Only fetch top-level comments
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        user: true,
        replies: {
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
      })),
    }));
  }
}
