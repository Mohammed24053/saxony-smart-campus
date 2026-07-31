import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtConfig } from '../../config/jwt.config';

export interface SocketPrincipal {
  userId: string;
  role: 'admin' | 'student' | 'doctor';
  universityId: string;
  email?: string | null;
}

interface AccessTokenPayload {
  sub: string;
  role: 'admin' | 'student' | 'doctor';
  uni: string;
  email?: string | null;
  twoFa?: boolean;
}

/**
 * Reads a JWT off a Socket.IO handshake (auth.token or Authorization header),
 * verifies it with the configured RS256 public key, and pins the resulting
 * principal on `socket.data.user`. Throws a string error on any failure —
 * callers should disconnect the socket on rejection.
 *
 * Socket.IO's `Authorization` may arrive as `Bearer <jwt>` or as the bare
 * JWT in the `auth.token` payload (which is what every official client SDK
 * sends when configured with `{ auth: { token } }`).
 */
export function readBearer(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  const tokenFromAuth =
    auth && typeof auth.token === 'string' && auth.token.length > 0 ? auth.token : null;
  if (tokenFromAuth) return tokenFromAuth;

  const headers = socket.handshake.headers;
  const raw = headers['authorization'] ?? headers['Authorization'];
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/^Bearer\s+/i, '').trim() || null;
  }
  return null;
}

export async function authenticateSocket(
  socket: Socket,
  jwt: JwtService,
  config: ConfigService,
  logger?: Logger,
): Promise<SocketPrincipal> {
  const token = readBearer(socket);
  if (!token) {
    logger?.debug(`socket ${socket.id} rejected: no token`);
    throw new Error('UNAUTHORIZED');
  }
  const cfg = config.getOrThrow<JwtConfig>('jwt');
  let payload: AccessTokenPayload;
  try {
    payload = (await jwt.verifyAsync(token, {
      publicKey: cfg.accessPublicKey,
      algorithms: [cfg.algorithm],
    })) as AccessTokenPayload;
  } catch (err) {
    logger?.debug(`socket ${socket.id} rejected: ${(err as Error)?.message ?? err}`);
    throw new Error('UNAUTHORIZED');
  }
  if (!payload?.sub || !payload?.role || !payload?.uni) {
    throw new Error('UNAUTHORIZED');
  }
  const principal: SocketPrincipal = {
    userId: payload.sub,
    role: payload.role,
    universityId: payload.uni,
    email: payload.email ?? null,
  };
  socket.data.user = principal;
  return principal;
}

export function getPrincipal(socket: Socket): SocketPrincipal | null {
  const u = socket.data?.user;
  if (!u || typeof u !== 'object') return null;
  return u as SocketPrincipal;
}
