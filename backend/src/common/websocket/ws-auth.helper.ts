import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

export interface WsPrincipal {
  userId: string;
  role: 'admin' | 'student' | 'doctor';
  universityId: string;
  email?: string | null;
}

interface AccessTokenClaims {
  sub: string;
  role: 'admin' | 'student' | 'doctor';
  uni: string;
  email?: string | null;
}

/**
 * Extract and verify the JWT access token off a socket.io handshake. Tokens
 * may be supplied via:
 *   - `auth.token` (socket.io-client `auth: { token }` option) — preferred
 *   - `Authorization: Bearer …` header (mobile WebSocket clients)
 *
 * Returns the resolved principal or `null` if no valid token was supplied.
 * Callers are expected to disconnect unauthenticated sockets.
 */
export async function verifySocketHandshake(
  client: Socket,
  jwt: JwtService,
  logger?: Logger,
): Promise<WsPrincipal | null> {
  const raw =
    (typeof client.handshake.auth?.token === 'string' && client.handshake.auth.token) ||
    (typeof client.handshake.headers?.authorization === 'string' &&
      client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')) ||
    '';
  if (!raw) return null;
  try {
    const payload = await jwt.verifyAsync<AccessTokenClaims>(raw);
    if (!payload?.sub || !payload?.role || !payload?.uni) return null;
    return {
      userId: payload.sub,
      role: payload.role,
      universityId: payload.uni,
      email: payload.email,
    };
  } catch (err) {
    logger?.debug(`Rejected WS handshake: ${(err as Error)?.message ?? err}`);
    return null;
  }
}
