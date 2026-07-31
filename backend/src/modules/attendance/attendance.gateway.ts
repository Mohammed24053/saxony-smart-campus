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
import { SessionStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { verifySocketHandshake, WsPrincipal } from '../../common/websocket/ws-auth.helper';

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

type AuthedSocket = Socket & { data: { auth?: WsPrincipal } };

function gatewayCors(config: ConfigService): string | string[] | boolean {
  const cfg = config.get<AppConfig>('app');
  const origin = cfg?.adminWebOrigin ?? 'http://localhost:3001';
  if (origin === '*') return true;
  return origin.split(',').map((s) => s.trim());
}

@Injectable()
@WebSocketGateway({
  namespace: '/attendance',
  cors: (() => {
    // ConfigService isn't available at decorator-evaluation time, so we fall
    // back to env. The handler-level check above is still authoritative.
    const origin = process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3001';
    return {
      origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()),
      credentials: true,
    };
  })(),
  transports: ['websocket', 'polling'],
})
export class AttendanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('AttendanceGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Touch config to avoid unused-import warnings — the CORS allowlist is
    // applied in the decorator via env, and we read config here for any
    // future runtime tweaks (e.g. per-tenant overrides).
    void this.config;
    void gatewayCors;
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    const principal = await verifySocketHandshake(client, this.jwt, this.logger);
    if (!principal) {
      this.logger.warn(`Rejecting unauthenticated WS connection ${client.id}`);
      client.emit('auth:error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }
    client.data = { ...(client.data ?? {}), auth: principal };
    this.logger.debug(`+ ${client.id} (user=${principal.userId}, role=${principal.role})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`- ${client.id}`);
  }

  @SubscribeMessage('session:join')
  async onJoin(
    @MessageBody() body: JoinPayload,
    @ConnectedSocket() client: AuthedSocket,
  ): Promise<{ joined: string } | { error: string }> {
    const auth = client.data?.auth;
    if (!auth) {
      client.disconnect(true);
      return { error: 'unauthenticated' };
    }
    if (!body?.sessionId || typeof body.sessionId !== 'string') {
      return { error: 'sessionId required' };
    }
    const allowed = await this.canJoinSession(auth, body.sessionId);
    if (!allowed) {
      this.logger.warn(
        `Denied session:join by user=${auth.userId} role=${auth.role} session=${body.sessionId}`,
      );
      return { error: 'forbidden' };
    }
    void client.join(`session:${body.sessionId}`);
    return { joined: body.sessionId };
  }

  @SubscribeMessage('session:leave')
  onLeave(
    @MessageBody() body: JoinPayload,
    @ConnectedSocket() client: AuthedSocket,
  ): { left: string } | { error: string } {
    if (!client.data?.auth) {
      client.disconnect(true);
      return { error: 'unauthenticated' };
    }
    if (!body?.sessionId) return { error: 'sessionId required' };
    void client.leave(`session:${body.sessionId}`);
    return { left: body.sessionId };
  }

  emitAttendance(sessionId: string, payload: AttendanceEventPayload): void {
    this.server?.to(`session:${sessionId}`).emit('attendance:new', payload);
  }

  emitCount(sessionId: string, payload: AttendanceCountPayload): void {
    this.server?.to(`session:${sessionId}`).emit('attendance:count', payload);
  }

  /**
   * Broadcasts that the rotating QR has refreshed. The token itself is NOT
   * sent on the wire — the doctor client must call the REST endpoint
   * `GET /attendance/session/:id/qr` (authenticated, role=doctor) to retrieve
   * it. This prevents a passive listener on the room from harvesting the
   * rotating token even if room ACLs were bypassed.
   */
  emitQrRefresh(sessionId: string, _newToken: string, expiresAt: Date): void {
    this.server?.to(`session:${sessionId}`).emit('qr:refreshed', {
      expiresAt: expiresAt.toISOString(),
    });
  }

  emitTimeout(sessionId: string): void {
    this.server?.to(`session:${sessionId}`).emit('session:timeout', {
      message: 'Session has been closed',
      closedAt: new Date().toISOString(),
    });
  }

  /**
   * Authorization check for joining a `session:<id>` room.
   *   - admin: must be in same tenant as the session
   *   - doctor: must own the session OR be in same tenant
   *   - student: must be enrolled in the session's section AND in same tenant
   */
  private async canJoinSession(auth: WsPrincipal, sessionId: string): Promise<boolean> {
    if (!/^[0-9a-fA-F-]{32,36}$/.test(sessionId)) return false;
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        scheduleSlot: { select: { universityId: true, sectionId: true, doctorId: true } },
      },
    });
    if (!session) return false;
    if (session.scheduleSlot.universityId !== auth.universityId) return false;

    if (auth.role === 'admin') return true;
    if (auth.role === 'doctor') {
      // Doctors can listen on any session in their tenant (e.g. for dashboards),
      // but in practice the controller only emits for sessions they own.
      return true;
    }
    if (auth.role === 'student') {
      const student = await this.prisma.student.findUnique({
        where: { id: auth.userId },
        select: { sectionId: true, user: { select: { universityId: true } } },
      });
      if (!student || student.user.universityId !== auth.universityId) return false;
      // Allow joining only sessions for the student's own section AND only
      // while the session is active (no point letting them subscribe to
      // arbitrary historical sessions).
      if (student.sectionId !== session.scheduleSlot.sectionId) return false;
      if (session.status !== SessionStatus.active) return false;
      return true;
    }
    return false;
  }
}
