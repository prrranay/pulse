import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
      const isDev = process.env.NODE_ENV !== 'production';
      if (!origin) {
        if (isDev) {
          callback(null, true);
        } else {
          callback(new Error('Origin required in production'));
        }
      } else if (origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown> | undefined;
      const token = auth?.token as string | undefined;

      if (!token) {
        this.logger.warn(`Chat client connection rejected: No token provided.`);
        client.disconnect(true);
        return;
      }

      // Verify token
      const payload: unknown = this.jwtService.verify(token);
      let userId: string | undefined;

      if (payload && typeof payload === 'object') {
        userId = (payload as Record<string, any>).sub as string | undefined;
      }

      if (!userId) {
        this.logger.warn(
          `Chat client connection rejected: Invalid payload sub.`,
        );
        client.disconnect(true);
        return;
      }

      // Store authenticated user ID
      client.data = { userId };

      // Update lastActiveAt in database
      this.prisma.user
        .update({
          where: { id: userId },
          data: { lastActiveAt: new Date() },
        })
        .catch((err: unknown) => {
          this.logger.error('Failed to update lastActiveAt on connect:', err);
        });

      // Track Redis presence
      const onlineKey = `online:user:${userId}`;
      const activeSocketsBefore = await this.redisService
        .getClient()
        .scard(onlineKey);
      await this.redisService.getClient().sadd(onlineKey, client.id);

      // Join client to their user room
      await client.join(`user_${userId}`);

      // Auto-join authorized conversation rooms
      const participantConvs =
        await this.prisma.conversationParticipant.findMany({
          where: { userId },
          select: { conversationId: true },
        });

      for (const pc of participantConvs) {
        await client.join(`conversation:${pc.conversationId}`);
      }

      if (activeSocketsBefore === 0) {
        // User came online! Broadcast presence.
        this.broadcastPresence(userId, 'online').catch((err: unknown) => {
          this.logger.error(
            `Failed to broadcast online presence for ${userId}:`,
            err,
          );
        });
      }

      this.logger.log(
        `Chat client ${client.id} authenticated, joined room user_${userId} and ${participantConvs.length} conversation rooms`,
      );
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.warn(
        `Chat client connection rejected: Auth failed: ${error?.message}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Chat client disconnected: ${client.id}`);
    const userId = (client.data as { userId?: string })?.userId;
    if (userId) {
      try {
        const onlineKey = `online:user:${userId}`;
        await this.redisService.getClient().srem(onlineKey, client.id);
        const activeSocketsAfter = await this.redisService
          .getClient()
          .scard(onlineKey);

        if (activeSocketsAfter === 0) {
          // User went offline! Broadcast presence.
          await this.broadcastPresence(userId, 'offline');
        }
      } catch (err: unknown) {
        this.logger.error(
          `Failed to track disconnect presence for ${userId}:`,
          err,
        );
      }
    }
  }

  private async broadcastPresence(
    userId: string,
    status: 'online' | 'offline',
  ) {
    if (!this.server) return;

    try {
      const participantConvs =
        await this.prisma.conversationParticipant.findMany({
          where: { userId },
          select: { conversationId: true },
        });

      for (const pc of participantConvs) {
        this.server
          .to(`conversation:${pc.conversationId}`)
          .emit('user_presence', {
            userId,
            status,
          });
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to query conversation rooms for presence broadcast of ${userId}:`,
        err,
      );
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody('conversationId') conversationId: string,
  ) {
    const userId = (client.data as { userId?: string })?.userId;
    if (!userId) {
      this.logger.warn(
        `Unauthorized joinConversation attempt: Socket ${client.id} has no authenticated user`,
      );
      client.emit('error', 'Unauthorized');
      return;
    }

    if (!conversationId) {
      client.emit('error', 'Conversation ID required');
      return;
    }

    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        this.logger.warn(`Conversation ${conversationId} not found`);
        client.emit('error', 'Conversation not found');
        return;
      }

      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        this.logger.warn(
          `User ${userId} is not a participant in conversation ${conversationId}`,
        );
        client.emit('error', 'Access denied');
        return;
      }

      await client.join(`conversation:${conversationId}`);
      this.logger.log(
        `Socket ${client.id} (user ${userId}) joined room conversation:${conversationId}`,
      );
      client.emit('joinedConversation', { conversationId });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error joining conversation room: ${error.message}`);
      client.emit('error', 'Failed to join conversation');
    }
  }

  sendMessage(recipientId: string, conversationId: string, message: any) {
    if (!this.server) {
      this.logger.warn('Chat Socket server not initialized yet');
      return;
    }
    this.server.to(`conversation:${conversationId}`).emit('message', message);
    this.server.to(`user_${recipientId}`).emit('message', message);
    this.logger.log(
      `Emitted chat message to conversation:${conversationId} and user_${recipientId}`,
    );
  }

  sendReadReceipt(
    recipientId: string,
    conversationId: string,
    payload: { conversationId: string; readAt: Date },
  ) {
    if (!this.server) {
      this.logger.warn('Chat Socket server not initialized yet');
      return;
    }
    this.server
      .to(`conversation:${conversationId}`)
      .emit('messages_read', payload);
    this.server.to(`user_${recipientId}`).emit('messages_read', payload);
    this.logger.log(
      `Emitted messages_read to conversation:${conversationId} and user_${recipientId}`,
    );
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ) {
    const userId = (client.data as { userId?: string })?.userId;
    if (!userId) {
      client.emit('error', 'Unauthorized');
      return;
    }

    const { conversationId, isTyping } = payload;
    if (!conversationId) {
      client.emit('error', 'Conversation ID required');
      return;
    }

    try {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      });

      if (!participant) {
        client.emit('error', 'Access denied');
        return;
      }

      client.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        isTyping,
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error handling typing event: ${error.message}`);
    }
  }
}
export type { Socket };
