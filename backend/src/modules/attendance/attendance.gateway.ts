import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface JoinPayload {
  sessionId: string;
}

export interface AttendanceEventPayload {
  studentId: string;
  studentName: string;
  status: string;
  scannedAt: string;
}

export interface AttendanceCountPayload {
  present: number;
  late: number;
  absent: number;
  total: number;
}

@Injectable()
@WebSocketGateway({
  namespace: '/attendance',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('AttendanceGateway');

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`+ ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`- ${client.id}`);
  }

  @SubscribeMessage('session:join')
  onJoin(@MessageBody() body: JoinPayload, @ConnectedSocket() client: Socket): { joined: string } {
    client.join(`session:${body.sessionId}`);
    return { joined: body.sessionId };
  }

  @SubscribeMessage('session:leave')
  onLeave(@MessageBody() body: JoinPayload, @ConnectedSocket() client: Socket): { left: string } {
    client.leave(`session:${body.sessionId}`);
    return { left: body.sessionId };
  }

  emitAttendance(sessionId: string, payload: AttendanceEventPayload): void {
    this.server?.to(`session:${sessionId}`).emit('attendance:new', payload);
  }

  emitCount(sessionId: string, payload: AttendanceCountPayload): void {
    this.server?.to(`session:${sessionId}`).emit('attendance:count', payload);
  }

  emitQrRefresh(sessionId: string, newToken: string, expiresAt: Date): void {
    this.server?.to(`session:${sessionId}`).emit('qr:refreshed', {
      newToken,
      expiresAt: expiresAt.toISOString(),
    });
  }

  emitTimeout(sessionId: string): void {
    this.server?.to(`session:${sessionId}`).emit('session:timeout', {
      message: 'Session has been closed',
      closedAt: new Date().toISOString(),
    });
  }
}
