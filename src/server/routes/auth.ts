import { Router } from 'express';
import crypto from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  sessions,
  wallets,
  regions,
  districts,
  mfys,
  notifications,
  drivers,
} from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import {
  firebaseRegisterSchema,
  loginSchema,
  onboardingSchema,
  registerSchema,
  uzPhoneSchema,
} from '../../lib/domain.ts';
import { generateOpaqueToken, hashPassword, sha256Hex, verifyPassword } from '../crypto.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';

export const authRouter = Router();

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function createSessionForUser(userId: number) {
  const rawToken = generateOpaqueToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { rawToken, expiresAt };
}

function isHttpsRequest(req: import('express').Request): boolean {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase();
  return req.secure || forwarded === 'https' || process.env.NODE_ENV === 'production';
}

function setSessionCookie(
  req: import('express').Request,
  res: import('express').Response,
  rawToken: string,
  expiresAt: Date
) {
  const useCrossSiteCookie = isHttpsRequest(req);
  res.cookie('yashnar_session', rawToken, {
    httpOnly: true,
    sameSite: useCrossSiteCookie ? 'none' : 'lax',
    secure: useCrossSiteCookie,
    expires: expiresAt,
    path: '/',
  });
}

async function serializeFullProfile(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, u.id)).limit(1);
  const [region] = u.regionId
    ? await db.select().from(regions).where(eq(regions.id, u.regionId)).limit(1)
    : [];
  const [district] = u.districtId
    ? await db.select().from(districts).where(eq(districts.id, u.districtId)).limit(1)
    : [];
  const [mfy] = u.mfyId
    ? await db.select().from(mfys).where(eq(mfys.id, u.mfyId)).limit(1)
    : [];

  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, u.id), eq(notifications.isRead, false)));

  let driverInfo = null;
  if (u.role === 'driver') {
    const [d] = await db.select().from(drivers).where(eq(drivers.userId, u.id)).limit(1);
    if (d) {
      driverInfo = {
        id: d.id,
        approvalStatus: d.approvalStatus,
        vehiclePlate: d.vehiclePlate,
        vehicleCapacityLiters: d.vehicleCapacityLiters,
      };
    }
  }

  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    accountStatus: u.accountStatus,
    regionId: u.regionId,
    regionName: region?.name ?? null,
    districtId: u.districtId,
    districtName: district?.name ?? null,
    mfyId: u.mfyId,
    mfyName: mfy?.name ?? null,
    mfyStatus: mfy?.status ?? null,
    publicLeaderboardName: u.publicLeaderboardName,
    leaderboardVisible: u.leaderboardVisible,
    onboardingCompleted: u.onboardingCompleted,
    themePreference: u.themePreference,
    unreadNotifications: unreadRow?.count ?? 0,
    wallet: wallet
      ? {
          coinBalance: wallet.coinBalance,
          totalXp: wallet.totalXp,
          currentLevel: wallet.currentLevel,
          currentStreak: wallet.currentStreak,
          longestStreak: wallet.longestStreak,
        }
      : { coinBalance: 0, totalXp: 0, currentLevel: 1, currentStreak: 0, longestStreak: 0 },
    driver: driverInfo,
  };
}

// Public signup — strictly creates citizen accounts only (used by local fallback & integration tests)
authRouter.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Ma’lumotlar noto‘g‘ri kiritildi.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const [dist] = await db
      .select()
      .from(districts)
      .where(and(eq(districts.id, parsed.data.districtId), eq(districts.isActive, true)))
      .limit(1);
    if (!dist) {
      return res.status(400).json({ error: 'Tanlangan tuman topilmadi.' });
    }

    const email = parsed.data.email.toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return res.status(409).json({ error: 'Ushbu elektron pochta allaqachon ro‘yxatdan o‘tgan.' });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const uid = `local:${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        passwordHash,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        regionId: dist.regionId,
        districtId: dist.id,
        role: 'citizen', // Forced citizen role on public signup
        accountStatus: 'active',
        publicLeaderboardName: parsed.data.fullName.split(' ')[0] || parsed.data.fullName,
        leaderboardVisible: true,
        onboardingCompleted: false,
      })
      .returning({ id: users.id });

    await db.insert(wallets).values({ userId: created.id }).onConflictDoNothing();

    const { rawToken, expiresAt } = await createSessionForUser(created.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    const profile = await serializeFullProfile(created.id);
    return res.status(201).json({ user: profile, sessionToken: rawToken });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Ro‘yxatdan o‘tishda server xatoligi yuz berdi.' });
  }
});

// Email-verified Firebase signup — enforces decoded.email_verified === true server-side
authRouter.post('/firebase-register', async (req, res) => {
  try {
    if (!adminAuth) {
      return res.status(503).json({
        error: 'Elektron pochta tasdiqlash xizmati hozircha sozlanmagan.',
      });
    }

    const parsed = firebaseRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Ma’lumotlar noto‘g‘ri kiritildi.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
    const email = (decoded.email ?? '').toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Hisobdan elektron pochta olinmadi.' });
    }
    if (!decoded.email_verified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        error:
          'Elektron pochtangiz hali tasdiqlanmagan. Pochtangizga yuborilgan havolani bosing va qaytadan urinib ko‘ring.',
      });
    }

    const [dist] = await db
      .select()
      .from(districts)
      .where(and(eq(districts.id, parsed.data.districtId), eq(districts.isActive, true)))
      .limit(1);
    if (!dist) {
      return res.status(400).json({ error: 'Tanlangan tuman topilmadi.' });
    }

    let [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (!u) {
      [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (u) {
        await db
          .update(users)
          .set({
            uid: decoded.uid,
            fullName: parsed.data.fullName,
            phone: parsed.data.phone,
            regionId: dist.regionId,
            districtId: dist.id,
            updatedAt: new Date(),
          })
          .where(eq(users.id, u.id));
      } else {
        const [inserted] = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            email,
            fullName: parsed.data.fullName,
            phone: parsed.data.phone,
            regionId: dist.regionId,
            districtId: dist.id,
            role: 'citizen', // Forced citizen role on public signup
            accountStatus: 'active',
            publicLeaderboardName: parsed.data.fullName.split(' ')[0] || parsed.data.fullName,
            leaderboardVisible: true,
            onboardingCompleted: false,
          })
          .returning();
        u = inserted;
        await db.insert(wallets).values({ userId: u.id }).onConflictDoNothing();
      }
    }

    if (u.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan.' });
    }

    const { rawToken, expiresAt } = await createSessionForUser(u.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    const profile = await serializeFullProfile(u.id);
    return res.status(201).json({ user: profile, sessionToken: rawToken });
  } catch (err) {
    console.error('Firebase register error:', err);
    return res.status(401).json({
      error: 'Elektron pochta tasdiqlanishi tekshirilmadi. Qaytadan urinib ko‘ring.',
    });
  }
});

// Email-verified Firebase login — enforces decoded.email_verified === true server-side
authRouter.post('/firebase-login', async (req, res) => {
  try {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken || !adminAuth) {
      return res.status(400).json({ error: 'Autentifikatsiya tokeni taqdim etilmadi.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email ?? '').toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Hisobdan elektron pochta olinmadi.' });
    }
    if (!decoded.email_verified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        error: 'Kirishdan oldin elektron pochtangizga yuborilgan havola orqali tasdiqlang.',
      });
    }

    let [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (!u) {
      [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (u) {
        await db
          .update(users)
          .set({ uid: decoded.uid, updatedAt: new Date() })
          .where(eq(users.id, u.id));
      } else {
        const displayName = decoded.name || email.split('@')[0] || 'Foydalanuvchi';
        const [inserted] = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            email,
            fullName: displayName,
            phone: '',
            role: 'citizen',
            accountStatus: 'active',
            publicLeaderboardName: displayName.split(' ')[0] || displayName,
            leaderboardVisible: true,
            onboardingCompleted: false,
          })
          .returning();
        u = inserted;
        await db.insert(wallets).values({ userId: u.id }).onConflictDoNothing();
      }
    }

    if (u.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan.' });
    }

    const { rawToken, expiresAt } = await createSessionForUser(u.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    const profile = await serializeFullProfile(u.id);
    return res.json({ user: profile, sessionToken: rawToken });
  } catch (err) {
    console.error('Firebase login error:', err);
    return res.status(401).json({ error: 'Kirish tasdiqlanmadi. Email va parolni tekshiring.' });
  }
});

// SMS-verified Firebase Phone Auth login/signup — enforces decoded.phone_number server-side
authRouter.post('/phone-login', async (req, res) => {
  try {
    if (!adminAuth) {
      return res.status(503).json({
        error: 'SMS tasdiqlash xizmati hozircha sozlanmagan.',
      });
    }

    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    const rawFullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const rawDistrictId =
      typeof req.body?.districtId === 'number' && Number.isInteger(req.body.districtId) && req.body.districtId > 0
        ? req.body.districtId
        : null;

    if (!idToken || idToken.length < 20) {
      return res.status(400).json({ error: 'SMS tasdiqlash tokeni taqdim etilmadi.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const verifiedPhone = typeof decoded.phone_number === 'string' ? decoded.phone_number.trim() : '';
    if (!verifiedPhone) {
      return res.status(403).json({
        code: 'PHONE_NOT_VERIFIED',
        error: 'Telefon raqami SMS orqali tasdiqlanmagan.',
      });
    }

    let resolvedDistrict: { id: number; regionId: number } | null = null;
    if (rawDistrictId) {
      const [dist] = await db
        .select({ id: districts.id, regionId: districts.regionId })
        .from(districts)
        .where(and(eq(districts.id, rawDistrictId), eq(districts.isActive, true)))
        .limit(1);
      if (dist) {
        resolvedDistrict = dist;
      }
    }

    // Match by Firebase UID first, then by exact verified phone number (never elevate role)
    let [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (!u) {
      [u] = await db.select().from(users).where(eq(users.phone, verifiedPhone)).limit(1);
      if (u) {
        await db
          .update(users)
          .set({
            uid: decoded.uid,
            ...(rawFullName.length >= 2 && !u.fullName ? { fullName: rawFullName.slice(0, 120) } : {}),
            ...(resolvedDistrict && !u.districtId
              ? { regionId: resolvedDistrict.regionId, districtId: resolvedDistrict.id }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, u.id));
      } else {
        const digitsOnly = verifiedPhone.replace(/\D/g, '');
        const syntheticEmail = `phone.${digitsOnly}@phone.yashnar.uz`;
        const displayName =
          rawFullName.length >= 2
            ? rawFullName.slice(0, 120)
            : `Foydalanuvchi ${digitsOnly.slice(-4) || 'YASHNAR'}`;

        const [inserted] = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            email: syntheticEmail,
            fullName: displayName,
            phone: verifiedPhone,
            regionId: resolvedDistrict?.regionId ?? null,
            districtId: resolvedDistrict?.id ?? null,
            role: 'citizen', // Public SMS signup always creates citizen
            accountStatus: 'active',
            publicLeaderboardName: displayName.split(' ')[0] || displayName,
            leaderboardVisible: true,
            onboardingCompleted: false,
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { uid: decoded.uid, phone: verifiedPhone, updatedAt: new Date() },
          })
          .returning();
        u = inserted;
        await db.insert(wallets).values({ userId: u.id }).onConflictDoNothing();
      }
    }

    if (u.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan.' });
    }

    const { rawToken, expiresAt } = await createSessionForUser(u.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    const profile = await serializeFullProfile(u.id);
    return res.json({ user: profile, sessionToken: rawToken });
  } catch (err) {
    console.error('Firebase phone login error:', err);
    return res.status(401).json({
      error: 'SMS tasdiqlash tekshirilmadi. Qaytadan urinib ko‘ring.',
    });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Email va parolni kiriting.',
      });
    }

    const email = parsed.data.email.toLowerCase();
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !u.passwordHash) {
      return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri.' });
    }

    const valid = await verifyPassword(parsed.data.password, u.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri.' });
    }

    if (u.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan. Administratorga murojaat qiling.' });
    }

    const { rawToken, expiresAt } = await createSessionForUser(u.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    const profile = await serializeFullProfile(u.id);
    return res.json({ user: profile, sessionToken: rawToken });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Kirishda server xatoligi yuz berdi.' });
  }
});

// Real Google OAuth verification via Firebase Admin ID token
authRouter.post('/google', async (req, res) => {
  try {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken || !adminAuth) {
      return res.status(400).json({
        error: 'Google autentifikatsiya tokeni taqdim etilmadi yoki provayder sozlanmagan.',
      });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email ?? '').toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Google hisobidan elektron pochta olinmadi.' });
    }

    // Check by uid first, then by email (to link existing user safely without elevating role)
    let [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (!u) {
      [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (u) {
        await db
          .update(users)
          .set({ uid: decoded.uid, updatedAt: new Date() })
          .where(eq(users.id, u.id));
      } else {
        const displayName = decoded.name || email.split('@')[0] || 'Foydalanuvchi';
        const [inserted] = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            email,
            fullName: displayName,
            phone: '',
            role: 'citizen', // Public Google signup always creates citizen
            accountStatus: 'active',
            publicLeaderboardName: displayName.split(' ')[0] || displayName,
            leaderboardVisible: true,
            onboardingCompleted: false,
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: { email, updatedAt: new Date() },
          })
          .returning();
        u = inserted;
        await db.insert(wallets).values({ userId: u.id }).onConflictDoNothing();
      }
    }

    if (u.accountStatus === 'suspended') {
      return res.status(403).json({ error: 'Hisobingiz vaqtincha bloklangan.' });
    }

    const { rawToken, expiresAt } = await createSessionForUser(u.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    const profile = await serializeFullProfile(u.id);
    return res.json({ user: profile, sessionToken: rawToken });
  } catch (err) {
    console.error('Google auth verification error:', err);
    return res.status(401).json({
      error: 'Google orqali kirish tasdiqlanmadi. Qaytadan urinib ko‘ring.',
    });
  }
});

authRouter.post('/logout', async (req: AuthRequest, res) => {
  try {
    const cookieToken = req.cookies?.yashnar_session as string | undefined;
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : undefined;

    for (const token of [cookieToken, bearerToken]) {
      if (token) {
        await db.delete(sessions).where(eq(sessions.tokenHash, sha256Hex(token)));
      }
    }
    const useCrossSiteCookie = isHttpsRequest(req);
    res.clearCookie('yashnar_session', {
      httpOnly: true,
      sameSite: useCrossSiteCookie ? 'none' : 'lax',
      secure: useCrossSiteCookie,
      path: '/',
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Chiqishda xatolik yuz berdi.' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Yaroqli elektron pochta manzilini kiriting.' });
  }
  return res.json({
    ok: true,
    message:
      'Agar ushbu email tizimda mavjud bo‘lsa, parolni tiklash bo‘yicha ko‘rsatmalar administrator orqali yoki Google hisobi orqali amalga oshiriladi.',
  });
});

authRouter.get('/me', async (req: AuthRequest, res) => {
  if (!req.currentUser) {
    return res.json({ user: null });
  }
  const profile = await serializeFullProfile(req.currentUser.id);
  return res.json({ user: profile });
});

authRouter.post('/onboarding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Barcha majburiy maydonlarni to‘ldiring.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    // Look up selected district and auto-resolve its authoritative region (Namangan viloyati)
    const [dist] = await db
      .select()
      .from(districts)
      .where(and(eq(districts.id, parsed.data.districtId), eq(districts.isActive, true)))
      .limit(1);
    if (!dist) {
      return res.status(400).json({ error: 'Tanlangan tuman topilmadi.' });
    }

    const [mfyRow] = await db
      .select()
      .from(mfys)
      .where(and(eq(mfys.id, parsed.data.mfyId), eq(mfys.districtId, dist.id)))
      .limit(1);
    if (!mfyRow) {
      return res.status(400).json({ error: 'Tanlangan MFY ushbu tumanga tegishli emas.' });
    }

    const effectiveMfyId = mfyRow.status === 'merged' && mfyRow.mergedIntoId ? mfyRow.mergedIntoId : mfyRow.id;

    await db
      .update(users)
      .set({
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        regionId: dist.regionId,
        districtId: dist.id,
        mfyId: effectiveMfyId,
        publicLeaderboardName: parsed.data.publicLeaderboardName,
        leaderboardVisible: parsed.data.leaderboardVisible,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.currentUser!.id));

    await db.insert(wallets).values({ userId: req.currentUser!.id }).onConflictDoNothing();

    const profile = await serializeFullProfile(req.currentUser!.id);
    return res.json({ user: profile });
  } catch (err) {
    console.error('Onboarding error:', err);
    return res.status(500).json({ error: 'Ma’lumotlarni saqlashda xatolik yuz berdi.' });
  }
});

authRouter.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof req.body?.fullName === 'string' && req.body.fullName.trim().length >= 2) {
      updates.fullName = req.body.fullName.trim().slice(0, 100);
    }
    if (typeof req.body?.phone === 'string' && req.body.phone.trim()) {
      const phoneCheck = uzPhoneSchema.safeParse(req.body.phone);
      if (!phoneCheck.success) {
        return res.status(400).json({ error: phoneCheck.error.issues[0]?.message });
      }
      updates.phone = phoneCheck.data;
    }
    if (typeof req.body?.publicLeaderboardName === 'string' && req.body.publicLeaderboardName.trim().length >= 2) {
      updates.publicLeaderboardName = req.body.publicLeaderboardName.trim().slice(0, 60);
    }
    if (typeof req.body?.leaderboardVisible === 'boolean') {
      updates.leaderboardVisible = req.body.leaderboardVisible;
    }
    if (req.body?.themePreference === 'light' || req.body?.themePreference === 'dark') {
      updates.themePreference = req.body.themePreference;
    }

    await db.update(users).set(updates).where(eq(users.id, req.currentUser!.id));
    const profile = await serializeFullProfile(req.currentUser!.id);
    return res.json({ user: profile });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Profilni yangilashda xatolik yuz berdi.' });
  }
});
