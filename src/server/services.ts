import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { eq, sql, lt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  wallets,
  xpLedger,
  coinLedger,
  notifications,
  notificationDeliveries,
  auditLogs,
  rewardRules,
  achievements,
  driverLocations,
  systemSettings,
} from '../db/schema.ts';
import {
  calculateLevelFromXp,
  calculateStreak,
  DEFAULT_VOLUME_ESTIMATES,
  getStreakMilestoneReward,
  getTashkentDateString,
  GPS_PURGE_AGE_MS,
} from '../lib/domain.ts';
import { broadcastInvalidation } from './realtime.ts';

export const PRIVATE_REPORTS_DIR = path.resolve(process.cwd(), 'private_storage', 'reports');

export async function getConfiguredVolumeEstimates(): Promise<Record<string, number>> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'volume_estimates'))
    .limit(1);
  if (!row) return { ...DEFAULT_VOLUME_ESTIMATES };
  try {
    const parsed = JSON.parse(row.valueJson) as Record<string, number>;
    return { ...DEFAULT_VOLUME_ESTIMATES, ...parsed };
  } catch {
    return { ...DEFAULT_VOLUME_ESTIMATES };
  }
}

export async function getRewardRule(code: string): Promise<{ xpAmount: number; coinAmount: number }> {
  const [rule] = await db
    .select()
    .from(rewardRules)
    .where(eq(rewardRules.code, code))
    .limit(1);
  if (rule && rule.isActive) {
    return { xpAmount: rule.xpAmount, coinAmount: rule.coinAmount };
  }
  const fallbacks: Record<string, { xpAmount: number; coinAmount: number }> = {
    verified_qr_pickup: { xpAmount: 25, coinAmount: 5 },
    daily_quiz: { xpAmount: 10, coinAmount: 2 },
    approved_report: { xpAmount: 15, coinAmount: 3 },
    participation: { xpAmount: 10, coinAmount: 2 },
    streak_7: { xpAmount: 20, coinAmount: 5 },
    streak_30: { xpAmount: 100, coinAmount: 20 },
  };
  return fallbacks[code] ?? { xpAmount: 0, coinAmount: 0 };
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function awardXpAndCoinsTx(
  tx: DbTx,
  params: {
    userId: number;
    eventKey: string;
    sourceType: string;
    sourceId: string;
    xpAmount: number;
    coinAmount: number;
    description: string;
    qualifiesForStreak?: boolean;
  }
): Promise<{ awarded: boolean; xpGranted: number; coinsGranted: number; milestoneBonus?: { xp: number; coins: number } }> {
  const localDate = getTashkentDateString(new Date());

  // Ensure wallet exists
  await tx.insert(wallets).values({ userId: params.userId }).onConflictDoNothing();

  // Idempotent insert into xp_ledger
  let xpInserted = false;
  if (params.xpAmount > 0) {
    const inserted = await tx
      .insert(xpLedger)
      .values({
        userId: params.userId,
        eventKey: params.eventKey,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        xpAmount: params.xpAmount,
        localDateTashkent: localDate,
        description: params.description,
      })
      .onConflictDoNothing()
      .returning({ id: xpLedger.id });
    xpInserted = inserted.length > 0;
  }

  let coinInserted = false;
  if (params.coinAmount > 0) {
    const inserted = await tx
      .insert(coinLedger)
      .values({
        userId: params.userId,
        eventKey: params.eventKey,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        coinAmount: params.coinAmount,
        description: params.description,
      })
      .onConflictDoNothing()
      .returning({ id: coinLedger.id });
    coinInserted = inserted.length > 0;
  }

  if (!xpInserted && !coinInserted) {
    return { awarded: false, xpGranted: 0, coinsGranted: 0 };
  }

  // Recompute total XP & streak strictly from actual xp_ledger
  const xpRows = await tx
    .select({
      xpAmount: xpLedger.xpAmount,
      localDateTashkent: xpLedger.localDateTashkent,
      sourceType: xpLedger.sourceType,
    })
    .from(xpLedger)
    .where(eq(xpLedger.userId, params.userId));

  let totalXp = xpRows.reduce((sum, r) => sum + r.xpAmount, 0);
  const qualifyingDates = xpRows
    .filter((r) => r.sourceType !== 'streak_milestone')
    .map((r) => r.localDateTashkent);

  const streakInfo = calculateStreak(qualifyingDates, localDate);
  let milestoneBonus: { xp: number; coins: number } | undefined;

  if (params.qualifiesForStreak !== false) {
    const milestone = getStreakMilestoneReward(streakInfo.currentStreak);
    if (milestone) {
      const rule = await getRewardRule(milestone.milestoneCode);
      const streakEventKey = `${milestone.milestoneCode}:${params.userId}:${localDate}`;
      const [ach] = await tx
        .insert(achievements)
        .values({
          userId: params.userId,
          code: milestone.milestoneCode,
          title: `${streakInfo.currentStreak} kunlik seriya`,
          localDateTashkent: localDate,
        })
        .onConflictDoNothing()
        .returning({ id: achievements.id });

      if (ach) {
        await tx
          .insert(xpLedger)
          .values({
            userId: params.userId,
            eventKey: streakEventKey,
            sourceType: 'streak_milestone',
            sourceId: String(streakInfo.currentStreak),
            xpAmount: rule.xpAmount,
            localDateTashkent: localDate,
            description: `${streakInfo.currentStreak} kunlik seriya bonusi`,
          })
          .onConflictDoNothing();
        await tx
          .insert(coinLedger)
          .values({
            userId: params.userId,
            eventKey: streakEventKey,
            sourceType: 'streak_milestone',
            sourceId: String(streakInfo.currentStreak),
            coinAmount: rule.coinAmount,
            description: `${streakInfo.currentStreak} kunlik seriya bonusi`,
          })
          .onConflictDoNothing();
        totalXp += rule.xpAmount;
        milestoneBonus = { xp: rule.xpAmount, coins: rule.coinAmount };
      }
    }
  }

  // Recompute coin balance from coin_ledger for 100% ledger consistency
  const [coinSum] = await tx
    .select({ sum: sql<number>`coalesce(sum(${coinLedger.coinAmount}), 0)::int` })
    .from(coinLedger)
    .where(eq(coinLedger.userId, params.userId));

  const levelInfo = calculateLevelFromXp(totalXp);

  await tx
    .update(wallets)
    .set({
      totalXp,
      coinBalance: Math.max(0, coinSum?.sum ?? 0),
      currentLevel: levelInfo.level,
      currentStreak: streakInfo.currentStreak,
      longestStreak: Math.max(streakInfo.longestStreak, streakInfo.currentStreak),
      lastActiveDate: streakInfo.lastActiveDate,
      updatedAt: new Date(),
    })
    .where(eq(wallets.userId, params.userId));

  return {
    awarded: true,
    xpGranted: params.xpAmount + (milestoneBonus?.xp ?? 0),
    coinsGranted: params.coinAmount + (milestoneBonus?.coins ?? 0),
    milestoneBonus,
  };
}

export async function createNotificationTx(
  tx: DbTx,
  params: {
    userId: number;
    type: string;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }
) {
  const [notif] = await tx
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
    })
    .returning();

  await tx.insert(notificationDeliveries).values({
    notificationId: notif.id,
    channel: 'in_app',
    status: 'delivered',
  });

  return notif;
}

export async function recordAuditLogTx(
  tx: DbTx,
  params: {
    actorUserId: number;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.insert(auditLogs).values({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    metadataJson: JSON.stringify(params.metadata ?? {}),
  });
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MiB

/**
 * Decodes and validates a base64 or Buffer image (JPEG, PNG, WebP, max 5 MiB),
 * strips EXIF metadata, resizes long edge <= 1600px, encodes JPEG at 82% quality,
 * and writes to private storage outside public/.
 */
export async function processAndStoreReportPhoto(imageDataUrlOrBase64: string): Promise<string> {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    imageDataUrlOrBase64.trim()
  );
  if (!match) {
    throw new Error('Faqat JPEG, PNG yoki WebP formatidagi rasm qabul qilinadi.');
  }

  const rawBuffer = Buffer.from(match[2], 'base64');
  if (rawBuffer.byteLength === 0) {
    throw new Error('Rasm fayli bo‘sh.');
  }
  if (rawBuffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Rasm hajmi 5 MiB dan oshmasligi kerak.');
  }

  // Decode & verify format via sharp (prevents forged MIME headers)
  const image = sharp(rawBuffer, { failOn: 'error' });
  const metadata = await image.metadata();
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new Error('Rasm formati yaroqsiz. Faqat JPEG, PNG yoki WebP yuklang.');
  }

  // Resize long edge <= 1600px, auto-orient, strip metadata (no withMetadata), JPEG 82%
  const processedBuffer = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  await fs.mkdir(PRIVATE_REPORTS_DIR, { recursive: true });
  const key = `${crypto.randomUUID()}.jpg`;
  const targetPath = path.join(PRIVATE_REPORTS_DIR, key);
  await fs.writeFile(targetPath, processedBuffer);

  return key;
}

export async function purgeAbandonedLocations(): Promise<void> {
  const cutoff = new Date(Date.now() - GPS_PURGE_AGE_MS);
  await db.delete(driverLocations).where(lt(driverLocations.receivedAt, cutoff));
}

export function emitAfterCommit(options: Parameters<typeof broadcastInvalidation>[0]) {
  setImmediate(() => {
    broadcastInvalidation(options);
  });
}
