import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown> | undefined;
      const query = client.handshake.query as
        Record<string, unknown> | undefined;
      const token = (auth?.token || query?.token) as string | undefined;

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

      // Join client to their user room
      await client.join(`user_${userId}`);
      this.logger.log(
        `Chat client ${client.id} authenticated and joined room user_${userId}`,
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

  sendMessage(recipientId: string, message: any) {
    if (!this.server) {
      this.logger.warn('Chat Socket server not initialized yet');
      return;
    }
    this.server.to(`user_${recipientId}`).emit('message', message);
    this.logger.log(`Emitted chat message to room user_${recipientId}`);
  }

  sendReadReceipt(
    recipientId: string,
    payload: { conversationId: string; readAt: Date },
  ) {
    if (!this.server) {
      this.logger.warn('Chat Socket server not initialized yet');
      return;
    }
    this.server.to(`user_${recipientId}`).emit('messages_read', payload);
    this.logger.log(`Emitted messages_read to room user_${recipientId}`);
  }
}
export type { Socket };
