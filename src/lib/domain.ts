import { z } from 'zod';

// ============================================================
// 1. CONSTANTS & EXACT SPECIFICATIONS
// ============================================================

export const WASTE_CATEGORIES = [
  'Plastik',
  'Qog‘oz',
  'Shisha',
  'Metall',
  'Organik',
  'Aralash maishiy chiqindi',
  'Boshqa',
] as const;

export type WasteCategory = (typeof WASTE_CATEGORIES)[number];

export const VOLUME_RANGE_OPTIONS = [
  { range: '0–30 L', defaultLiters: 15 },
  { range: '31–60 L', defaultLiters: 45 },
  { range: '61–120 L', defaultLiters: 90 },
  { range: '121–240 L', defaultLiters: 180 },
  { range: '240+ L', defaultLiters: 300 },
] as const;

export type VolumeRangeKey = (typeof VOLUME_RANGE_OPTIONS)[number]['range'];

export const DEFAULT_VOLUME_ESTIMATES: Record<string, number> = {
  '0–30 L': 15,
  '31–60 L': 45,
  '61–120 L': 90,
  '121–240 L': 180,
  '240+ L': 300,
};

export const REPORT_STATUSES = [
  'submitted',
  'reviewing',
  'assigned',
  'en_route',
  'arrived',
  'completed',
  'cancelled',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CANCELLABLE_REPORT_STATUSES: ReadonlySet<ReportStatus> = new Set([
  'submitted',
  'reviewing',
  'assigned',
]);

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Yuborildi',
  reviewing: 'Ko‘rib chiqilmoqda',
  assigned: 'Biriktirildi',
  en_route: 'Haydovchi yo‘lda',
  arrived: 'Yetib keldi',
  completed: 'Yig‘im bajarildi',
  cancelled: 'Bekor qilindi',
};

export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent UTC+05:00 (no DST)

// ============================================================
// 2. MFY / DISTRICT NORMALIZATION
// ============================================================

/**
 * Normalizes Unicode, spaces, case, punctuation and Uzbek apostrophes
 * for strict district-scoped MFY uniqueness.
 */
export function normalizeGeographyName(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u2018\u2019\u02BB\u02BC\u0060\u00B4']/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDisplayName(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// 3. GAMIFICATION: 100 LEVELS, XP THRESHOLDS & STREAKS
// ============================================================

export function getLevelThreshold(level: number): number {
  const clamped = Math.max(1, Math.min(100, Math.floor(level)));
  return 25 * (clamped - 1) * (clamped - 1);
}

export function getLevelTitle(level: number): string {
  if (level <= 10) return 'Eco Beginner';
  if (level <= 25) return 'Eco Explorer';
  if (level <= 50) return 'Eco Guardian';
  if (level <= 75) return 'Eco Champion';
  return 'Eco Legend';
}

export interface LevelProgress {
  level: number;
  title: string;
  currentXp: number;
  currentLevelMinXp: number;
  nextLevelMinXp: number | null;
  progressPercent: number;
}

export function calculateLevelFromXp(totalXp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));
  let level = Math.floor(Math.sqrt(safeXp / 25)) + 1;
  if (level < 1) level = 1;
  if (level > 100) level = 100;

  while (level < 100 && getLevelThreshold(level + 1) <= safeXp) {
    level += 1;
  }
  while (level > 1 && getLevelThreshold(level) > safeXp) {
    level -= 1;
  }

  const currentLevelMinXp = getLevelThreshold(level);
  const nextLevelMinXp = level < 100 ? getLevelThreshold(level + 1) : null;
  const progressPercent =
    nextLevelMinXp === null
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(((safeXp - currentLevelMinXp) / (nextLevelMinXp - currentLevelMinXp)) * 100)
          )
        );

  return {
    level,
    title: getLevelTitle(level),
    currentXp: safeXp,
    currentLevelMinXp,
    nextLevelMinXp,
    progressPercent,
  };
}

/**
 * Returns YYYY-MM-DD in Asia/Tashkent (UTC+5).
 */
export function getTashkentDateString(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Deterministic 0-based daily index from an Asia/Tashkent YYYY-MM-DD date string.
 * Advances by +1 every calendar day and wraps cleanly across `totalCount`.
 */
export function getDailyRotationIndex(tashkentDateStr: string, totalCount: number): number {
  if (!Number.isInteger(totalCount) || totalCount <= 0) return 0;
  const [y, m, d] = tashkentDateStr.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0;
  const utcDayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const anchorDay = Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
  const offset = utcDayNumber - anchorDay;
  return ((offset % totalCount) + totalCount) % totalCount;
}

/**
 * Computes current streak & longest streak from unique local YYYY-MM-DD activity dates.
 * - Multiple events on one date count as one active day.
 * - A streak remains current when the last active date is today or yesterday (in Asia/Tashkent).
 */
export function calculateStreak(
  activeDates: string[],
  todayTashkent: string = getTashkentDateString()
): { currentStreak: number; longestStreak: number; lastActiveDate: string | null } {
  const uniqueSorted = Array.from(new Set(activeDates.filter(Boolean))).sort();
  if (uniqueSorted.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  let longestStreak = 1;
  let running = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    if (addDaysToDateString(uniqueSorted[i - 1], 1) === uniqueSorted[i]) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 1;
    }
  }

  const lastActiveDate = uniqueSorted[uniqueSorted.length - 1];
  const yesterday = addDaysToDateString(todayTashkent, -1);

  if (lastActiveDate !== todayTashkent && lastActiveDate !== yesterday) {
    return { currentStreak: 0, longestStreak, lastActiveDate };
  }

  let currentStreak = 1;
  for (let i = uniqueSorted.length - 1; i > 0; i--) {
    if (addDaysToDateString(uniqueSorted[i - 1], 1) === uniqueSorted[i]) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak, lastActiveDate };
}

export function getStreakMilestoneReward(streakDays: number): {
  milestoneCode: string;
  xp: number;
  coins: number;
} | null {
  if (streakDays === 7) {
    return { milestoneCode: 'streak_7', xp: 20, coins: 5 };
  }
  if (streakDays === 30) {
    return { milestoneCode: 'streak_30', xp: 100, coins: 20 };
  }
  return null;
}

// ============================================================
// 4. WORKLOAD & COLLECTION MATH
// ============================================================

export interface WorkloadMetrics {
  estimatedPendingLiters: number;
  thresholdLiters: number;
  uncappedPercent: number;
  visualPercent: number;
  recommendedCollection: boolean;
}

export function calculateWorkload(
  estimatedPendingLiters: number,
  thresholdLiters: number
): WorkloadMetrics {
  if (!Number.isFinite(thresholdLiters) || thresholdLiters <= 0) {
    throw new Error('MFY yig‘im chegarasi musbat son bo‘lishi kerak.');
  }
  const safePending = Math.max(0, Number.isFinite(estimatedPendingLiters) ? estimatedPendingLiters : 0);
  const uncappedPercent = Math.round((safePending / thresholdLiters) * 1000) / 10;
  const visualPercent = Math.min(100, uncappedPercent);
  return {
    estimatedPendingLiters: safePending,
    thresholdLiters,
    uncappedPercent,
    visualPercent,
    recommendedCollection: uncappedPercent > 60,
  };
}

// ============================================================
// 5. GPS POLICY & HAVERSINE DISTANCE
// ============================================================

export const GPS_MIN_INTERVAL_MS = 15_000;
export const GPS_MIN_MOVEMENT_METERS = 20;
export const GPS_STATIONARY_HEARTBEAT_MS = 60_000;
export const GPS_STALE_THRESHOLD_MS = 120_000;
export const GPS_PURGE_AGE_MS = 24 * 60 * 60 * 1000;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function shouldSendGpsUpdate(
  lastSent: { lat: number; lng: number; timestampMs: number } | null,
  next: { lat: number; lng: number; timestampMs: number }
): { allow: boolean; reason: 'initial' | 'movement' | 'heartbeat' | 'throttled' | 'insufficient_movement' } {
  if (!lastSent) {
    return { allow: true, reason: 'initial' };
  }
  const elapsedMs = next.timestampMs - lastSent.timestampMs;
  if (elapsedMs < GPS_MIN_INTERVAL_MS) {
    return { allow: false, reason: 'throttled' };
  }
  const distanceMeters = haversineMeters(lastSent.lat, lastSent.lng, next.lat, next.lng);
  if (distanceMeters >= GPS_MIN_MOVEMENT_METERS) {
    return { allow: true, reason: 'movement' };
  }
  if (elapsedMs >= GPS_STATIONARY_HEARTBEAT_MS) {
    return { allow: true, reason: 'heartbeat' };
  }
  return { allow: false, reason: 'insufficient_movement' };
}

export function isLocationStale(receivedAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - receivedAtMs > GPS_STALE_THRESHOLD_MS;
}

// ============================================================
// 6. VALIDATION SCHEMAS (ZOD)
// ============================================================

export const uzPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+998\d{9}$/, 'Telefon raqami +998 va 9 ta raqamdan iborat bo‘lishi kerak (masalan: +998901234567).');

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'To‘liq ism kamida 2 ta belgidan iborat bo‘lishi kerak.')
      .max(100, 'To‘liq ism 100 ta belgidan oshmasligi kerak.'),
    email: z.string().trim().email('Yaroqli elektron pochta manzilini kiriting.'),
    districtId: z.number({ message: 'Tumanni tanlang.' }).int().positive('Tumanni tanlang.'),
    password: z
      .string()
      .min(12, 'Parol kamida 12 ta belgidan iborat bo‘lishi kerak.')
      .max(128, 'Parol 128 ta belgidan oshmasligi kerak.'),
    passwordConfirmation: z.string(),
    phone: uzPhoneSchema,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Parollar bir-biriga mos kelmadi.',
  });

export const firebaseRegisterSchema = z.object({
  idToken: z.string().min(20, 'Tasdiqlash tokeni yaroqsiz.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'To‘liq ism kamida 2 ta belgidan iborat bo‘lishi kerak.')
    .max(100, 'To‘liq ism 100 ta belgidan oshmasligi kerak.'),
  phone: uzPhoneSchema,
  districtId: z.number({ message: 'Tumanni tanlang.' }).int().positive('Tumanni tanlang.'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Yaroqli elektron pochta manzilini kiriting.'),
  password: z.string().min(1, 'Parolni kiriting.'),
});

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'To‘liq ism kamida 2 ta belgidan iborat bo‘lishi kerak.')
    .max(100, 'To‘liq ism 100 ta belgidan oshmasligi kerak.'),
  phone: uzPhoneSchema,
  regionId: z.number().int().positive().optional(),
  districtId: z.number({ message: 'Tumanni tanlang.' }).int().positive('Tumanni tanlang.'),
  mfyId: z.number({ message: 'MFYni tanlang.' }).int().positive('MFYni tanlang.'),
  publicLeaderboardName: z
    .string()
    .trim()
    .min(2, 'Reytingdagi ism kamida 2 ta belgidan iborat bo‘lishi kerak.')
    .max(60, 'Reytingdagi ism 60 ta belgidan oshmasligi kerak.'),
  leaderboardVisible: z.boolean(),
});

export const newMfySchema = z.object({
  districtId: z.number().int().positive('Tumanni tanlang.'),
  name: z
    .string()
    .trim()
    .min(2, 'MFY nomi kamida 2 ta belgidan iborat bo‘lishi kerak.')
    .max(100, 'MFY nomi 100 ta belgidan oshmasligi kerak.'),
});

export const createReportSchema = z.object({
  category: z.enum(WASTE_CATEGORIES, { message: 'Chiqindi toifasini tanlang.' }),
  estimatedRange: z.enum(['0–30 L', '31–60 L', '61–120 L', '121–240 L', '240+ L'], {
    message: 'Taxminiy hajm oralig‘ini tanlang.',
  }),
  description: z.string().trim().max(2000, 'Tavsif 2000 ta belgidan oshmasligi kerak.').default(''),
  address: z
    .string()
    .trim()
    .min(3, 'Manzilni kiriting (kamida 3 ta belgi).')
    .max(300, 'Manzil 300 ta belgidan oshmasligi kerak.'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const disputeSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'E’tiroz sababi kamida 10 ta belgidan iborat bo‘lishi kerak.')
    .max(2000, 'E’tiroz sababi 2000 ta belgidan oshmasligi kerak.'),
});

export const actualVolumeSchema = z
  .number({ message: 'Haqiqiy hajm son bo‘lishi kerak.' })
  .refine((val) => Number.isFinite(val), 'Haqiqiy hajm yaroqli son bo‘lishi kerak.')
  .refine((val) => val > 0, 'Haqiqiy hajm 0 dan katta bo‘lishi kerak.')
  .refine((val) => val <= 100000, 'Haqiqiy hajm 100 000 litrdan oshmasligi kerak.');

export const confirmPickupSchema = z.object({
  qrToken: z.string().min(16, 'Yaroqsiz QR kod.'),
  reportId: z.number().int().positive('Murojaatni tanlang.'),
  actualLiters: actualVolumeSchema,
  idempotencyKey: z.string().min(8).max(128),
});

export const aiQuestionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Savol kamida 3 ta belgidan iborat bo‘lishi kerak.')
    .max(1000, 'Savol 1000 ta belgidan oshmasligi kerak.'),
});
