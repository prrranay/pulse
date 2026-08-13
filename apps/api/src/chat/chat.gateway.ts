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

  handleDisconnect(client: Socket) {
    this.logger.log(`Chat client disconnected: ${client.id}`);
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
}
export type { Socket };
