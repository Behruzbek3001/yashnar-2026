import webpush from 'web-push';
import { Router } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { pushSubscriptions } from '../db/schema.ts';
import { requireAuth, type AuthRequest } from './auth.ts';

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const pushEnabled = Boolean(publicKey && privateKey);
if (pushEnabled) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@yashnar2026.com', publicKey, privateKey);
}

/** Send a phone/desktop push to every device the given users subscribed. Never throws. */
export async function sendPushToUsers(userIds: number[], payload: { title: string; body: string; url?: string }) {
  if (!pushEnabled || !userIds.length) return;
  try {
    const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/' });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 60 * 60,
          });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          } else {
            console.warn('Push failed:', code, (err as Error).message);
          }
        }
      })
    );
  } catch (err) {
    console.warn('Push dispatch error:', (err as Error).message);
  }
}

export const pushRouter = Router();

pushRouter.get('/push/public-key', (_req, res) => {
  res.json({ enabled: pushEnabled, publicKey: pushEnabled ? publicKey : null });
});

pushRouter.post('/push/subscribe', requireAuth, async (req: AuthRequest, res) => {
  const sub = req.body?.subscription;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return res.status(400).json({ error: 'Noto‘g‘ri obuna ma’lumoti.' });
  }
  try {
    await db
      .insert(pushSubscriptions)
      .values({ userId: req.currentUser!.id, endpoint, p256dh, auth })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: req.currentUser!.id, p256dh, auth } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Obunani saqlashda xatolik.' });
  }
});

pushRouter.post('/push/unsubscribe', requireAuth, async (req: AuthRequest, res) => {
  const endpoint = String(req.body?.endpoint ?? '');
  if (endpoint) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return res.json({ ok: true });
});
