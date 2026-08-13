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
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown> | undefined;
      const token = auth?.token as string | undefined;

      if (!token) {
        this.logger.warn(`Client connection rejected: No token provided.`);
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
        this.logger.warn(`Client connection rejected: Invalid payload sub.`);
        client.disconnect(true);
        return;
      }

      // Store authenticated user ID
      client.data = { userId };

      // Join client to their user room
      await client.join(`user_${userId}`);
      this.logger.log(
        `Client ${client.id} authenticated and joined room user_${userId}`,
      );
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.warn(
        `Client connection rejected: Auth failed: ${error?.message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendNotification(recipientId: string, notification: any) {
    if (!this.server) {
      this.logger.warn('Socket server not initialized yet');
      return;
    }
    this.server.to(`user_${recipientId}`).emit('notification', notification);
    this.logger.log(`Emitted notification to room user_${recipientId}`);
  }
}
export type { Socket };
