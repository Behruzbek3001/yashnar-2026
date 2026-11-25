import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { eq, and, gt } from 'drizzle-orm';
import { db, ensureSchemaReady } from '../db/index.ts';
import { sessions, users } from '../db/schema.ts';
import { sha256Hex } from './crypto.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

interface ClientMeta {
  ws: WebSocket;
  userId: number;
  role: string;
  mfyId: number | null;
}

const clients = new Set<ClientMeta>();

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      map[k] = v;
    }
  }
  return map;
}

export function attachRealtimeServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    try {
      await ensureSchemaReady();
      const url = new URL(req.url || '/ws', 'http://localhost');
      const tokenParam = url.searchParams.get('token');
      const cookies = parseCookieHeader(req.headers.cookie);
      const sessionCookie = cookies['yashnar_session'];

      let userRecord: { id: number; role: string; mfyId: number | null } | null = null;

      if (sessionCookie) {
        const hash = sha256Hex(sessionCookie);
        const found = await db
          .select({ id: users.id, role: users.role, mfyId: users.mfyId })
          .from(sessions)
          .innerJoin(users, eq(sessions.userId, users.id))
          .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, new Date())))
          .limit(1);
        if (found[0]) userRecord = found[0];
      } else if (tokenParam && adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(tokenParam);
          const found = await db
            .select({ id: users.id, role: users.role, mfyId: users.mfyId })
            .from(users)
            .where(eq(users.uid, decoded.uid))
            .limit(1);
          if (found[0]) userRecord = found[0];
        } catch {
          // Invalid token
        }
      }

      if (!userRecord) {
        ws.close(4401, 'Unauthorized');
        return;
      }

      const meta: ClientMeta = {
        ws,
        userId: userRecord.id,
        role: userRecord.role,
        mfyId: userRecord.mfyId,
      };
      clients.add(meta);

      ws.on('close', () => {
        clients.delete(meta);
      });
      ws.on('error', () => {
        clients.delete(meta);
      });
    } catch {
      ws.close(1011, 'Server error');
    }
  });

  return wss;
}

/**
 * Broadcasts minimal invalidation signals (never raw private addresses)
 * only to authorized subscribers so clients refetch via authenticated APIs.
 */
export function broadcastInvalidation(options: {
  keys: string[];
  userIds?: number[];
  mfyId?: number;
  includeAdmins?: boolean;
}) {
  const payload = JSON.stringify({
    type: 'invalidate',
    keys: options.keys,
    ts: Date.now(),
  });

  for (const client of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;

    const matchUser = options.userIds?.includes(client.userId);
    const matchMfy = options.mfyId !== undefined && client.mfyId === options.mfyId;
    const matchAdmin = options.includeAdmins && client.role === 'admin';

    if (matchUser || matchMfy || matchAdmin) {
      try {
        client.ws.send(payload);
      } catch {
        // Ignore broken sockets
      }
    }
  }
}
