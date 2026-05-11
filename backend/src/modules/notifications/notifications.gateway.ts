import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verifySocketHandshake, WsPrincipal } from '../../common/websocket/ws-auth.helper';

type AuthedSocket = Socket & { data: { auth?: WsPrincipal } };

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: (() => {
    const origin = process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3001';
    return {
      origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()),
      credentials: true,
    };
  })(),
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger('NotificationsGateway');

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    const principal = await verifySocketHandshake(client, this.jwt, this.logger);
    if (!principal) {
      this.logger.warn(`Rejecting unauthenticated WS connection ${client.id}`);
      client.emit('auth:error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }
    client.data = { ...(client.data ?? {}), auth: principal };
    // Subscribe automatically to the authenticated user's room. No need for
    // a client `user:subscribe` event with a user-supplied ID — that was the
    // IDOR vector.
    void client.join(`user:${principal.userId}`);
    this.logger.debug(`+ ${client.id} subscribed to user:${principal.userId}`);
  }

  /**
   * Kept for backwards compatibility with older clients. The payload userId
   * is now ignored — we always use the authenticated principal.
   */
  @SubscribeMessage('user:subscribe')
  onSubscribe(@ConnectedSocket() client: AuthedSocket): { ok: boolean } {
    if (!client.data?.auth) {
      client.disconnect(true);
      return { ok: false };
    }
    void client.join(`user:${client.data.auth.userId}`);
    return { ok: true };
  }

  emitNew(
    userId: string,
    payload: { id: string; type: string; title: string; body: string; sentAt: string },
  ): void {
    this.server?.to(`user:${userId}`).emit('notification:new', payload);
  }
}
