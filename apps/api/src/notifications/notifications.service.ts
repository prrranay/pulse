import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationQueryDto } from './dto/notifications.dto';
import { NotificationType, Notification } from '@prisma/client';

export interface ActorSummary {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface NotificationResponse {
  id: string;
  recipientId: string;
  type: NotificationType;
  readAt: Date | null;
  createdAt: Date;
  actor: ActorSummary;
  post: { id: string; content: string } | null;
  comment: { id: string; content: string } | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createNotification(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    postId?: string,
    commentId?: string,
  ): Promise<Notification | null> {
    // A user shouldn't be notified of their own actions
    if (recipientId === actorId) {
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type,
        postId,
        commentId,
      },
      include: {
        actor: true,
        post: true,
        comment: true,
      },
    });

    // Format response to emit via WebSocket
    const formattedNotification: NotificationResponse = {
      id: notification.id,
      recipientId: notification.recipientId,
      type: notification.type,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actor: {
        id: notification.actor.id,
        username: notification.actor.username,
        displayName: notification.actor.displayName,
        avatarUrl: notification.actor.avatarUrl,
      },
      post: notification.post
        ? { id: notification.post.id, content: notification.post.content }
        : null,
      comment: notification.comment
        ? { id: notification.comment.id, content: notification.comment.content }
        : null,
    };

    // Emit socket event
    this.gateway.sendNotification(recipientId, formattedNotification);

    return notification;
  }

  async getNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationResponse[]> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const list = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: true,
        post: true,
        comment: true,
      },
    });

    return list.map((n) => ({
      id: n.id,
      recipientId: n.recipientId,
      type: n.type,
      readAt: n.readAt,
      createdAt: n.createdAt,
      actor: {
        id: n.actor.id,
        username: n.actor.username,
        displayName: n.actor.displayName,
        avatarUrl: n.actor.avatarUrl,
      },
      post: n.post ? { id: n.post.id, content: n.post.content } : null,
      comment: n.comment
        ? { id: n.comment.id, content: n.comment.content }
        : null,
    }));
  }

  async markAsRead(userId: string, id: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.recipientId !== userId) {
      throw new ForbiddenException('You cannot modify this notification');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      include: {
        actor: true,
        post: true,
        comment: true,
      },
    });

    return {
      id: updated.id,
      recipientId: updated.recipientId,
      type: updated.type,
      readAt: updated.readAt,
      createdAt: updated.createdAt,
      actor: {
        id: updated.actor.id,
        username: updated.actor.username,
        displayName: updated.actor.displayName,
        avatarUrl: updated.actor.avatarUrl,
      },
      post: updated.post
        ? { id: updated.post.id, content: updated.post.content }
        : null,
      comment: updated.comment
        ? { id: updated.comment.id, content: updated.comment.content }
        : null,
    };
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }
}
