import type { Request, Response, NextFunction } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessions, users, drivers } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { sha256Hex } from './crypto.ts';
import { ensureSeeded } from './seed.ts';

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'citizen' | 'driver' | 'admin';
  accountStatus: 'active' | 'suspended';
  regionId: number | null;
  districtId: number | null;
  mfyId: number | null;
  publicLeaderboardName: string | null;
  leaderboardVisible: boolean;
  onboardingCompleted: boolean;
  themePreference: string;
  driverId: number | null;
  driverApprovalStatus: string | null;
}

export interface AuthRequest extends Request {
  currentUser?: AuthUser;
}

async function loadUserById(userId: number): Promise<AuthUser | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;

  let driverId: number | null = null;
  let driverApprovalStatus: string | null = null;
  if (u.role === 'driver') {
    const [d] = await db.select().from(drivers).where(eq(drivers.userId, u.id)).limit(1);
    if (d) {
      driverId = d.id;
      driverApprovalStatus = d.approvalStatus;
    }
  }

  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role as AuthUser['role'],
    accountStatus: u.accountStatus as AuthUser['accountStatus'],
    regionId: u.regionId,
    districtId: u.districtId,
    mfyId: u.mfyId,
    publicLeaderboardName: u.publicLeaderboardName,
    leaderboardVisible: u.leaderboardVisible,
    onboardingCompleted: u.onboardingCompleted,
    themePreference: u.themePreference,
    driverId,
    driverApprovalStatus,
  };
}

export async function resolveAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await ensureSeeded();

    // 1. Check HttpOnly session cookie first, then Authorization Bearer opaque session token (for cross-site iframes)
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined;

    const candidateSessionTokens = [
      req.cookies?.yashnar_session as string | undefined,
      bearerToken,
    ].filter((t): t is string => Boolean(t));

    for (const token of candidateSessionTokens) {
      const hash = sha256Hex(token);
      const [sess] = await db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, new Date())))
        .limit(1);

      if (sess) {
        const u = await loadUserById(sess.userId);
        if (u) {
          req.currentUser = u;
          return next();
        }
      }
    }

    // 2. Fallback: check Firebase Bearer ID token
    if (bearerToken && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(bearerToken);
        const [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
        if (u) {
          const loaded = await loadUserById(u.id);
          if (loaded) req.currentUser = loaded;
        }
      } catch {
        // Token invalid or expired; proceed unauthenticated
      }
    }

    next();
  } catch (err) {
    console.error('Auth resolution error:', err);
    res.status(500).json({ error: 'Serverda autentifikatsiya xatoligi yuz berdi.' });
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    return res.status(401).json({ error: 'Tizimga kirish talab etiladi.' });
  }
  if (req.currentUser.accountStatus === 'suspended') {
    return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan. Administrator bilan bog‘laning.' });
  }
  next();
}

export function requireRole(...allowedRoles: Array<'citizen' | 'driver' | 'admin'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: 'Tizimga kirish talab etiladi.' });
    }
    if (req.currentUser.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan.' });
    }
    if (!allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).json({ error: 'Ushbu bo‘limga kirish uchun ruxsatingiz yo‘q.' });
    }
    if (req.currentUser.role === 'driver' && req.currentUser.driverApprovalStatus !== 'approved') {
      return res.status(403).json({ error: 'Haydovchi hisobingiz hali tasdiqlanmagan yoki to‘xtatilgan.' });
    }
    next();
  };
}
