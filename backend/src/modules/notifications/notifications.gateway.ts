import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface SubscribePayload {
  userId: string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(_client: Socket): void {
    // No-op; the client must `user:subscribe` after connecting.
  }

  @SubscribeMessage('user:subscribe')
  onSubscribe(@MessageBody() body: SubscribePayload, @ConnectedSocket() client: Socket): { ok: true } {
    client.join(`user:${body.userId}`);
    return { ok: true };
  }

  emitNew(userId: string, payload: { id: string; type: string; title: string; body: string; sentAt: string }): void {
    this.server?.to(`user:${userId}`).emit('notification:new', payload);
  }
}
