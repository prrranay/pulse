import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { FeedQueryDto } from '../posts/dto/posts.dto';

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  readAt: Date | null;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface ConversationResponse {
  id: string;
  updatedAt: Date;
  otherParticipant: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  lastMessage?: {
    content: string;
    createdAt: Date;
    senderId: string;
    readAt: Date | null;
  } | null;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async getConversations(userId: string): Promise<ConversationResponse[]> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              where: { userId: { not: userId } },
              include: { user: true },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const list = participants.map((p) => {
      const conv = p.conversation;
      const otherPartUser = conv.participants[0]?.user;
      const lastMsg = conv.messages[0];

      return {
        id: conv.id,
        updatedAt: conv.updatedAt,
        otherParticipant: {
          id: otherPartUser.id,
          username: otherPartUser.username,
          displayName: otherPartUser.displayName,
          avatarUrl: otherPartUser.avatarUrl,
        },
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              senderId: lastMsg.senderId,
              readAt: lastMsg.readAt,
            }
          : null,
      };
    });

    // Sort by updatedAt desc
    return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getOrCreateConversation(
    userId: string,
    targetUsername: string,
  ): Promise<ConversationResponse> {
    const targetUser = await this.prisma.user.findUnique({
      where: { username: targetUsername },
    });

    if (!targetUser) {
      throw new NotFoundException(`User @${targetUsername} not found`);
    }

    if (userId === targetUser.id) {
      throw new ForbiddenException('You cannot chat with yourself');
    }

    const directKey = [userId, targetUser.id].sort().join(':');

    // Attempt to find existing conversation by directKey
    const existingConv = await this.prisma.conversation.findUnique({
      where: { directKey },
      include: {
        participants: {
          where: { userId: { not: userId } },
          include: { user: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existingConv) {
      const otherPartUser = existingConv.participants[0]?.user;
      const lastMsg = existingConv.messages[0];

      return {
        id: existingConv.id,
        updatedAt: existingConv.updatedAt,
        otherParticipant: {
          id: otherPartUser.id,
          username: otherPartUser.username,
          displayName: otherPartUser.displayName,
          avatarUrl: otherPartUser.avatarUrl,
        },
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              senderId: lastMsg.senderId,
              readAt: lastMsg.readAt,
            }
          : null,
      };
    }

    try {
      // Create new conversation
      const newConv = await this.prisma.conversation.create({
        data: {
          directKey,
          participants: {
            create: [{ userId }, { userId: targetUser.id }],
          },
        },
        include: {
          participants: {
            where: { userId: { not: userId } },
            include: { user: true },
          },
        },
      });

      const otherPartUser = newConv.participants[0]?.user;

      return {
        id: newConv.id,
        updatedAt: newConv.updatedAt,
        otherParticipant: {
          id: otherPartUser.id,
          username: otherPartUser.username,
          displayName: otherPartUser.displayName,
          avatarUrl: otherPartUser.avatarUrl,
        },
        lastMessage: null,
      };
    } catch (error) {
      // Handle unique constraint races gracefully
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raceConv = await this.prisma.conversation.findUniqueOrThrow({
          where: { directKey },
          include: {
            participants: {
              where: { userId: { not: userId } },
              include: { user: true },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        const otherPartUser = raceConv.participants[0]?.user;
        const lastMsg = raceConv.messages[0];

        return {
          id: raceConv.id,
          updatedAt: raceConv.updatedAt,
          otherParticipant: {
            id: otherPartUser.id,
            username: otherPartUser.username,
            displayName: otherPartUser.displayName,
            avatarUrl: otherPartUser.avatarUrl,
          },
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                createdAt: lastMsg.createdAt,
                senderId: lastMsg.senderId,
                readAt: lastMsg.readAt,
              }
            : null,
        };
      }
      throw error;
    }
  }

  async getMessages(
    userId: string,
    conversationId: string,
    query?: FeedQueryDto,
  ) {
    const limit = query?.limit ?? 20;
    const cursor = query?.cursor;

    // Verify membership
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : undefined,
      include: {
        sender: true,
      },
    });

    // Mark messages as read asynchronously
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
    });

    if (unreadCount > 0) {
      const readAt = new Date();
      await this.prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: {
          readAt,
        },
      });

      // Get other participants to notify them
      const otherParticipants =
        await this.prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            userId: { not: userId },
          },
        });

      for (const p of otherParticipants) {
        this.chatGateway.sendReadReceipt(p.userId, conversationId, {
          conversationId,
          readAt,
        });
      }

      // Notify current user's background socket of their new unread count
      this.getUnreadCount(userId)
        .then((countRes) => {
          if (this.notificationsGateway.server) {
            this.notificationsGateway.server
              .to(`user_${userId}`)
              .emit('chat_unread_update', countRes);
          }
        })
        .catch((err) => {
          console.error('Failed to emit chat_unread_update:', err);
        });
    }

    let nextCursor: string | null = null;
    const items = [...messages];

    if (items.length > limit) {
      const lastItem = items.pop();
      nextCursor = lastItem ? lastItem.id : null;
    }

    const enrichedItems = items.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
      readAt: m.readAt,
      sender: {
        id: m.sender.id,
        username: m.sender.username,
        displayName: m.sender.displayName,
        avatarUrl: m.sender.avatarUrl,
      },
    }));

    return {
      items: enrichedItems,
      nextCursor,
    };
  }

  async sendMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ): Promise<MessageResponse> {
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
    });
    if (!sender) {
      throw new NotFoundException('Sender user not found');
    }

    // Verify membership
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    // Persist message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    });

    // Update conversation updatedAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Get target participants (other than sender)
    const otherParticipants =
      await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: senderId },
        },
      });

    const responseMsg: MessageResponse = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      readAt: message.readAt,
      sender: {
        id: sender.id,
        username: sender.username,
        displayName: sender.displayName,
        avatarUrl: sender.avatarUrl,
      },
    };

    // Emit event to all other participants
    for (const p of otherParticipants) {
      this.chatGateway.sendMessage(p.userId, conversationId, responseMsg);
      // Notify recipient's background socket of the new unread count
      this.getUnreadCount(p.userId)
        .then((countRes) => {
          if (this.notificationsGateway.server) {
            this.notificationsGateway.server
              .to(`user_${p.userId}`)
              .emit('chat_unread_update', countRes);
          }
        })
        .catch((err) => {
          console.error('Failed to emit chat_unread_update:', err);
        });
    }

    return responseMsg;
  }

  async markAsRead(userId: string, conversationId: string) {
    // Verify membership
    const membership = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
    });

    if (unreadCount > 0) {
      const readAt = new Date();
      await this.prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: {
          readAt,
        },
      });

      // Get target participants (other than current user) to notify them
      const otherParticipants =
        await this.prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            userId: { not: userId },
          },
        });

      for (const p of otherParticipants) {
        this.chatGateway.sendReadReceipt(p.userId, conversationId, {
          conversationId,
          readAt,
        });
      }

      // Notify current user's background socket of their new unread count
      this.getUnreadCount(userId)
        .then((countRes) => {
          if (this.notificationsGateway.server) {
            this.notificationsGateway.server
              .to(`user_${userId}`)
              .emit('chat_unread_update', countRes);
          }
        })
        .catch((err) => {
          console.error('Failed to emit chat_unread_update:', err);
        });
    }

    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    // Find all conversation IDs the user is participant of
    const userConversations =
      await this.prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });

    const conversationIds = userConversations.map((c) => c.conversationId);

    const count = await this.prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        readAt: null,
      },
    });

    return { count };
  }
}
