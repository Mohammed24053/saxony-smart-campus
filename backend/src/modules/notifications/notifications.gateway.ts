import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { authenticateSocket, getPrincipal } from '../../common/guards/ws-auth.helper';

/**
 * Per-user real-time notifications. Every connection is authenticated by a
 * JWT presented as `auth.token` on the Socket.IO handshake (preferred —
 * what the admin SDK sends) or as `Authorization: Bearer …`.
 *
 * Subscription model: there is no `userId` accepted from the wire.
 * `user:subscribe` always joins the room `user:<authenticated id>` —
 * this neutralises the previous cross-user IDOR.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger('NotificationsGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const principal = await authenticateSocket(client, this.jwt, this.config, this.logger);
      this.logger.debug(`+ ${client.id} user=${principal.userId} role=${principal.role}`);
    } catch {
      this.logger.debug(`+ ${client.id} unauthenticated — disconnecting`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('user:subscribe')
  onSubscribe(@ConnectedSocket() client: Socket): { ok: boolean; userId?: string; error?: string } {
    const principal = getPrincipal(client);
    if (!principal) {
      client.disconnect(true);
      return { ok: false, error: 'UNAUTHORIZED' };
    }
    client.join(`user:${principal.userId}`);
    return { ok: true, userId: principal.userId };
  }

  emitNew(
    userId: string,
    payload: { id: string; type: string; title: string; body: string; sentAt: string },
  ): void {
    this.server?.to(`user:${userId}`).emit('notification:new', payload);
  }
}
