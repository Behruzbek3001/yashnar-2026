import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getTashkentDateString } from '../lib/domain.ts';
import { requireAuth, type AuthRequest } from './auth.ts';

/** Firebase free plan allows 10 SMS per day for the whole project. */
export const DAILY_SMS_LIMIT = 10;

const rows = <T,>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

export async function ensurePhoneVerificationTables(): Promise<void> {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS sms_daily (
    id serial PRIMARY KEY,
    day text NOT NULL,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (day, user_id)
  )`);
}

const digits = (p: string) => p.replace(/\D/g, '');

/** Account that already uses this phone number, if any. */
export async function phoneOwner(phone: string): Promise<{ id: number; uid: string; email: string } | null> {
  const d = digits(phone);
  if (!d) return null;
  const r = rows<{ id: number; uid: string; email: string }>(
    await db.execute(sql`SELECT id, uid, email FROM users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${d} LIMIT 1`)
  );
  return r[0] ?? null;
}

export const PHONE_LOCKED_ERROR = 'Tasdiqlangan telefon raqamini o‘zgartirib bo‘lmaydi.';

/** True when another account already uses this phone number. */
export async function phoneInUse(phone: string, exceptUserId?: number): Promise<boolean> {
  const d = digits(phone);
  if (!d) return false;
  const r = rows<{ id: number }>(
    await db.execute(
      sql`SELECT id FROM users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${d} AND id <> ${exceptUserId ?? 0} LIMIT 1`
    )
  );
  return r.length > 0;
}

export const PHONE_TAKEN_ERROR = 'Bu telefon raqami boshqa hisobda ishlatilgan. Bitta raqam faqat bitta odamga tegishli bo‘lishi mumkin.';

/** Verified phones cannot be changed. */
export async function phoneLocked(userId: number): Promise<boolean> {
  const r = rows<{ v: string | null }>(await db.execute(sql`SELECT phone_verified_at AS v FROM users WHERE id = ${userId}`));
  return Boolean(r[0]?.v);
}

type State = 'verified' | 'no_phone' | 'selected' | 'sent' | 'waiting';

async function getState(userId: number): Promise<{ state: State; phone: string }> {
  const [u] = rows<{ phone: string; v: string | null }>(
    await db.execute(sql`SELECT phone, phone_verified_at AS v FROM users WHERE id = ${userId}`)
  );
  if (!u) return { state: 'no_phone', phone: '' };
  if (u.v) return { state: 'verified', phone: u.phone };
  if (!/^\+998\d{9}$/.test(u.phone || '')) return { state: 'no_phone', phone: '' };

  const day = getTashkentDateString();
  const [mine] = rows<{ status: string }>(
    await db.execute(sql`SELECT status FROM sms_daily WHERE day = ${day} AND user_id = ${userId}`)
  );
  if (mine) return { state: mine.status === 'selected' ? 'selected' : mine.status === 'verified' ? 'verified' : 'sent', phone: u.phone };

  // Pick this user for today if a slot is free and nobody used this number today.
  await db.execute(sql`
    INSERT INTO sms_daily (day, user_id, phone, status)
    SELECT ${day}, ${userId}, ${u.phone}, 'selected'
    WHERE (SELECT count(*) FROM sms_daily WHERE day = ${day}) < ${DAILY_SMS_LIMIT}
      AND NOT EXISTS (SELECT 1 FROM sms_daily WHERE day = ${day} AND regexp_replace(phone, '[^0-9]', '', 'g') = ${digits(u.phone)})
    ON CONFLICT (day, user_id) DO NOTHING`);
  const [picked] = rows<{ status: string }>(
    await db.execute(sql`SELECT status FROM sms_daily WHERE day = ${day} AND user_id = ${userId}`)
  );
  return { state: picked ? 'selected' : 'waiting', phone: u.phone };
}

const maskPhone = (p: string) => (p.length > 7 ? `${p.slice(0, 6)} ** *** ${p.slice(-4, -2)} ${p.slice(-2)}` : p);

export const phoneVerifyRouter = Router();

phoneVerifyRouter.get('/phone-verification/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.currentUser!.role === 'admin') return res.json({ state: 'verified' });
    const { state, phone } = await getState(req.currentUser!.id);
    return res.json({ state, phone: state === 'selected' ? phone : undefined, maskedPhone: phone ? maskPhone(phone) : undefined });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Holatni olishda xatolik.' });
  }
});

/** Marks today's single SMS as used. Must be called right before the client sends the SMS. */
phoneVerifyRouter.post('/phone-verification/start', requireAuth, async (req: AuthRequest, res) => {
  try {
    const day = getTashkentDateString();
    const r = rows<{ phone: string }>(
      await db.execute(
        sql`UPDATE sms_daily SET status = 'sent' WHERE day = ${day} AND user_id = ${req.currentUser!.id} AND status = 'selected' RETURNING phone`
      )
    );
    if (!r[0]) {
      return res.status(409).json({ error: 'Bugungi SMS allaqachon ishlatilgan. Qayta yuborib bo‘lmaydi.' });
    }
    return res.json({ phone: r[0].phone });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Xatolik yuz berdi.' });
  }
});

phoneVerifyRouter.post('/phone-verification/confirm', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!adminAuth) return res.status(503).json({ error: 'SMS tasdiqlash xizmati sozlanmagan.' });
    const idToken = String(req.body?.idToken ?? '');
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded?.phone_number) return res.status(400).json({ error: 'SMS tasdiqlanmadi.' });
    const userId = req.currentUser!.id;
    const [u] = rows<{ phone: string }>(await db.execute(sql`SELECT phone FROM users WHERE id = ${userId}`));
    if (!u || digits(u.phone) !== digits(decoded.phone_number)) {
      return res.status(400).json({ error: 'Tasdiqlangan raqam hisobingizdagi raqamga mos emas.' });
    }
    if (await phoneInUse(u.phone, userId)) return res.status(409).json({ error: PHONE_TAKEN_ERROR });
    await db.execute(sql`UPDATE users SET phone_verified_at = now() WHERE id = ${userId}`);
    await db.execute(
      sql`UPDATE sms_daily SET status = 'verified' WHERE day = ${getTashkentDateString()} AND user_id = ${userId}`
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Tasdiqlashda xatolik.' });
  }
});
