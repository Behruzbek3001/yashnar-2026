import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sha256Hex } from './crypto.ts';

// No 0/O/1/I/L to avoid typing mistakes. 8 chars ≈ 40 bits, valid only while the QR (10 min) is valid.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export async function ensureQrShortCodeTable(): Promise<void> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS qr_short_codes (
    code_digest text PRIMARY KEY,
    token_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`DELETE FROM qr_short_codes WHERE created_at < now() - interval '1 day'`);
}

const normalize = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Creates a short manual-entry code for a QR token digest; returns it formatted as XXXX-XXXX. */
export async function createShortCode(tokenDigest: string): Promise<string> {
  const bytes = crypto.randomBytes(8);
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  await db.execute(sql`INSERT INTO qr_short_codes (code_digest, token_digest) VALUES (${sha256Hex(code)}, ${tokenDigest})`);
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Accepts either the full QR token or the short code and returns the QR token digest. */
export async function resolveQrDigest(input: string): Promise<string> {
  const short = normalize(input);
  if (short.length === 8 && input.trim().length <= 10) {
    const r = (await db.execute(
      sql`SELECT token_digest FROM qr_short_codes WHERE code_digest = ${sha256Hex(short)} LIMIT 1`
    )) as unknown as { rows?: Array<{ token_digest: string }> };
    const row = (r.rows ?? (r as unknown as Array<{ token_digest: string }>))[0];
    if (row) return row.token_digest;
  }
  return sha256Hex(input.trim());
}
