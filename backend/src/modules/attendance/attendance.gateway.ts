import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
import { PrismaService } from '../../prisma/prisma.service';
import { authenticateSocket, getPrincipal } from '../../common/guards/ws-auth.helper';

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

/**
 * Real-time attendance feed. Every connection is authenticated by a JWT
 * presented either as `auth.token` on the Socket.IO handshake (preferred —
 * what the admin client uses) or as an `Authorization: Bearer …` header.
 *
 * Room model:
 *   `session:<id>` — joinable only by:
 *     • the doctor who owns the slot,
 *     • any admin in the same tenant, or
 *     • a student enrolled in the slot's section (so a student can listen
 *       for their own count update).
 *
 * Cross-tenant subscriptions are refused at `session:join`. The handler
 * returns an `{ error }` envelope on rejection — never silently joins.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/attendance',
  transports: ['websocket', 'polling'],
})
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('AttendanceGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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

  handleDisconnect(client: Socket): void {
    this.logger.debug(`- ${client.id}`);
  }

  @SubscribeMessage('session:join')
  async onJoin(
    @MessageBody() body: JoinPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined?: string; error?: string }> {
    const principal = getPrincipal(client);
    if (!principal) {
      client.disconnect(true);
      return { error: 'UNAUTHORIZED' };
    }
    if (!body || typeof body.sessionId !== 'string' || body.sessionId.length === 0) {
      return { error: 'INVALID_PAYLOAD' };
    }

    const session = await this.prisma.attendanceSession.findFirst({
      where: { id: body.sessionId },
      include: {
        scheduleSlot: { select: { universityId: true, doctorId: true, sectionId: true } },
      },
    });
    if (!session) return { error: 'NOT_FOUND' };
    if (session.scheduleSlot.universityId !== principal.universityId) {
      return { error: 'FORBIDDEN' };
    }

    if (principal.role === 'admin') {
      client.join(`session:${body.sessionId}`);
      return { joined: body.sessionId };
    }
    if (principal.role === 'doctor') {
      if (session.scheduleSlot.doctorId !== principal.userId) return { error: 'FORBIDDEN' };
      client.join(`session:${body.sessionId}`);
      return { joined: body.sessionId };
    }
    // role === 'student' — must be enrolled in the slot's section
    const student = await this.prisma.student.findUnique({ where: { id: principal.userId } });
    if (!student || student.sectionId !== session.scheduleSlot.sectionId) {
      return { error: 'FORBIDDEN' };
    }
    client.join(`session:${body.sessionId}`);
    return { joined: body.sessionId };
  }

  @SubscribeMessage('session:leave')
  onLeave(@MessageBody() body: JoinPayload, @ConnectedSocket() client: Socket): { left: string } {
    if (body && typeof body.sessionId === 'string') {
      client.leave(`session:${body.sessionId}`);
    }
    return { left: body?.sessionId ?? '' };
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
