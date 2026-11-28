import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { and, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  regions,
  districts,
  mfys,
  users,
  wallets,
  wasteReports,
  reportStatusEvents,
  disputes,
  qrCredentials,
  quests,
  questSubmissions,
  questCompletions,
  ecoFacts,
  xpLedger,
  coinLedger,
  marketRewards,
  redemptions,
  inventoryEvents,
  notifications,
  driverTrips,
  driverLocations,
  drivers,
  driverAssignments,
} from '../../db/schema.ts';
import {
  addDaysToDateString,
  calculateLevelFromXp,
  CANCELLABLE_REPORT_STATUSES,
  cleanDisplayName,
  createReportSchema,
  disputeSchema,
  getDailyRotationIndex,
  getTashkentDateString,
  isLocationStale,
  newMfySchema,
  normalizeGeographyName,
  type ReportStatus,
} from '../../lib/domain.ts';
import { generateOpaqueToken, generatePublicReportCode, sha256Hex } from '../crypto.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';
import { ensureSeeded } from '../seed.ts';
import {
  awardXpAndCoinsTx,
  createNotificationTx,
  emitAfterCommit,
  getConfiguredVolumeEstimates,
  getRewardRule,
  PRIVATE_REPORTS_DIR,
  processAndStoreReportPhoto,
  purgeAbandonedLocations,
} from '../services.ts';

export const citizenRouter = Router();

// ============================================================
// GEOGRAPHY (Public regions & 14 districts for signup/onboarding)
// ============================================================

citizenRouter.get('/geography/regions', async (_req, res) => {
  try {
    await ensureSeeded();
    const list = await db.select().from(regions).orderBy(regions.name);
    return res.json({ regions: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Viloyatlar ro‘yxatini yuklashda xatolik.' });
  }
});

citizenRouter.get('/geography/districts', async (req, res) => {
  try {
    await ensureSeeded();
    const regionId = Number(req.query.regionId);
    const list = Number.isFinite(regionId) && regionId > 0
      ? await db
          .select()
          .from(districts)
          .where(and(eq(districts.regionId, regionId), eq(districts.isActive, true)))
          .orderBy(districts.name)
      : await db.select().from(districts).where(eq(districts.isActive, true)).orderBy(districts.name);
    return res.json({ districts: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Tumanlar ro‘yxatini yuklashda xatolik.' });
  }
});

/**
 * Selects today's active quests:
 * - Picks exactly 1 quiz question per day deterministically from the active quiz pool (100 default questions)
 * - Includes all active non-quiz quests (report, participation)
 */
function selectTodayQuests<
  T extends { id: number; templateCode: string; questType: string }
>(allActiveQuests: T[], todayTashkent: string): {
  selected: Array<T & { quizDayNumber?: number; quizTotalCount?: number }>;
  todaysQuizId: number | null;
} {
  const quizPool = allActiveQuests
    .filter((q) => q.questType === 'quiz')
    .sort((a, b) => a.templateCode.localeCompare(b.templateCode));
  const otherQuests = allActiveQuests.filter((q) => q.questType !== 'quiz');

  const selected: Array<T & { quizDayNumber?: number; quizTotalCount?: number }> = [];
  let todaysQuizId: number | null = null;

  if (quizPool.length > 0) {
    const idx = getDailyRotationIndex(todayTashkent, quizPool.length);
    const todaysQuiz = quizPool[idx];
    todaysQuizId = todaysQuiz.id;
    selected.push({
      ...todaysQuiz,
      quizDayNumber: idx + 1,
      quizTotalCount: quizPool.length,
    });
  }

  for (const q of otherQuests) {
    selected.push(q);
  }

  return { selected, todaysQuizId };
}

citizenRouter.get('/geography/mfys', requireAuth, async (req, res) => {
  try {
    const districtId = Number(req.query.districtId);
    if (!Number.isFinite(districtId) || districtId <= 0) {
      return res.json({ mfys: [] });
    }
    const list = await db
      .select()
      .from(mfys)
      .where(and(eq(mfys.districtId, districtId), ne(mfys.status, 'merged')))
      .orderBy(mfys.name);
    return res.json({ mfys: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'MFYlar ro‘yxatini yuklashda xatolik.' });
  }
});

citizenRouter.post('/geography/mfys', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = newMfySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'MFY nomi yaroqsiz.' });
    }

    const displayName = cleanDisplayName(parsed.data.name);
    const normalizedName = normalizeGeographyName(displayName);
    if (normalizedName.length < 2) {
      return res.status(400).json({ error: 'MFY nomi kamida 2 ta harfdan iborat bo‘lishi kerak.' });
    }

    const [dist] = await db
      .select()
      .from(districts)
      .where(eq(districts.id, parsed.data.districtId))
      .limit(1);
    if (!dist) {
      return res.status(404).json({ error: 'Tuman topilmadi.' });
    }

    // Check district-scoped uniqueness across normalized names
    const [existing] = await db
      .select()
      .from(mfys)
      .where(and(eq(mfys.districtId, dist.id), eq(mfys.normalizedName, normalizedName)))
      .limit(1);

    if (existing) {
      return res.status(409).json({
        error: `“${existing.name}” MFY ushbu tumanda allaqachon mavjud. Ro‘yxatdan tanlang.`,
        existingMfy: existing,
      });
    }

    const [created] = await db
      .insert(mfys)
      .values({
        districtId: dist.id,
        name: displayName,
        normalizedName,
        status: 'pending',
        workloadThresholdLiters: 500,
        createdByUserId: req.currentUser!.id,
      })
      .returning();

    emitAfterCommit({ keys: ['mfys', 'admin-mfys'], includeAdmins: true });
    return res.status(201).json({ mfy: created });
  } catch (err) {
    console.error('Create MFY error:', err);
    return res.status(500).json({ error: 'Yangi MFY qo‘shishda xatolik yuz berdi.' });
  }
});

// ============================================================
// CITIZEN DASHBOARD
// ============================================================

citizenRouter.get('/citizen/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, u.id)).limit(1);
    const totalXp = wallet?.totalXp ?? 0;
    const coinBalance = wallet?.coinBalance ?? 0;
    const currentStreak = wallet?.currentStreak ?? 0;
    const levelInfo = calculateLevelFromXp(totalXp);

    const [completedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wasteReports)
      .where(and(eq(wasteReports.citizenId, u.id), eq(wasteReports.status, 'completed')));

    const [pendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wasteReports)
      .where(
        and(
          eq(wasteReports.citizenId, u.id),
          inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived'])
        )
      );

    // District rank (actual XP ledger totals for opted-in users in same district)
    let districtRank: number | null = null;
    let leaderboardPreview: Array<{
      rank: number;
      userId: number;
      displayName: string;
      xp: number;
      isCurrentUser: boolean;
    }> = [];

    if (u.districtId) {
      const rankedRows = await db
        .select({
          userId: users.id,
          displayName: users.publicLeaderboardName,
          fullName: users.fullName,
          xp: sql<number>`coalesce(sum(${xpLedger.xpAmount}), 0)::int`,
        })
        .from(users)
        .leftJoin(xpLedger, eq(xpLedger.userId, users.id))
        .where(
          and(
            eq(users.districtId, u.districtId),
            eq(users.role, 'citizen'),
            eq(users.leaderboardVisible, true),
            eq(users.accountStatus, 'active')
          )
        )
        .groupBy(users.id)
        .orderBy(desc(sql`coalesce(sum(${xpLedger.xpAmount}), 0)`), users.id);

      const formatted = rankedRows.map((r, idx) => ({
        rank: idx + 1,
        userId: r.userId,
        displayName: r.displayName || r.fullName.split(' ')[0] || 'Fuqaro',
        xp: r.xp,
        isCurrentUser: r.userId === u.id,
      }));
      const mine = formatted.find((r) => r.userId === u.id);
      districtRank = mine ? mine.rank : null;
      leaderboardPreview = formatted.slice(0, 5);
    }

    // Active pickup (most recent in-progress report)
    const [activePickup] = await db
      .select()
      .from(wasteReports)
      .where(
        and(
          eq(wasteReports.citizenId, u.id),
          inArray(wasteReports.status, ['assigned', 'en_route', 'arrived', 'reviewing', 'submitted'])
        )
      )
      .orderBy(desc(wasteReports.updatedAt))
      .limit(1);

    // Recent requests
    const recentRequests = await db
      .select()
      .from(wasteReports)
      .where(eq(wasteReports.citizenId, u.id))
      .orderBy(desc(wasteReports.createdAt))
      .limit(5);

    // Daily quests + completion status for Asia/Tashkent today (1 rotated daily quiz + action quests)
    const todayTashkent = getTashkentDateString(new Date());
    const allActiveQuests = await db
      .select({
        id: quests.id,
        templateCode: quests.templateCode,
        title: quests.title,
        description: quests.description,
        questType: quests.questType,
        xpReward: quests.xpReward,
        coinReward: quests.coinReward,
      })
      .from(quests)
      .where(eq(quests.isActive, true))
      .orderBy(quests.id);

    const { selected: activeQuests } = selectTodayQuests(allActiveQuests, todayTashkent);

    const completedToday = await db
      .select({ questId: questCompletions.questId })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, u.id),
          eq(questCompletions.localDateTashkent, todayTashkent)
        )
      );
    const completedSet = new Set(completedToday.map((c) => c.questId));

    // Daily eco fact (deterministic daily rotation by Tashkent date)
    const facts = await db.select().from(ecoFacts).where(eq(ecoFacts.isActive, true)).orderBy(ecoFacts.id);
    let dailyFact = null;
    if (facts.length > 0) {
      const dayNumber = Number(todayTashkent.replace(/-/g, ''));
      dailyFact = facts[dayNumber % facts.length];
    }

    // Recent notifications
    const recentNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, u.id))
      .orderBy(desc(notifications.createdAt))
      .limit(5);

    return res.json({
      stats: {
        totalXp,
        coinBalance,
        currentStreak,
        districtRank,
        completedPickups: completedRow?.count ?? 0,
        pendingRequests: pendingRow?.count ?? 0,
        level: levelInfo,
      },
      activePickup: activePickup ?? null,
      recentRequests,
      dailyQuests: activeQuests.map((q) => ({
        ...q,
        completedToday: completedSet.has(q.id),
      })),
      dailyFact,
      leaderboardPreview,
      recentNotifications,
    });
  } catch (err) {
    console.error('Citizen dashboard error:', err);
    return res.status(500).json({ error: 'Boshqaruv paneli ma’lumotlarini yuklashda xatolik.' });
  }
});

// ============================================================
// WASTE REPORTS & TIMELINE
// ============================================================

citizenRouter.get('/citizen/volume-estimates', requireAuth, async (_req, res) => {
  try {
    const estimates = await getConfiguredVolumeEstimates();
    return res.json({ estimates });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Hajm sozlamalarini yuklashda xatolik.' });
  }
});

citizenRouter.post('/citizen/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    if (!u.districtId || !u.mfyId) {
      return res.status(400).json({ error: 'Avval mahallangizni (onboarding) tanlang.' });
    }

    const parsed = createReportSchema.safeParse({
      category: req.body?.category,
      estimatedRange: req.body?.estimatedRange,
      description: req.body?.description ?? '',
      address: req.body?.address,
      latitude: req.body?.latitude ?? null,
      longitude: req.body?.longitude ?? null,
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Murojaat ma’lumotlari noto‘g‘ri.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    if (typeof req.body?.photoDataUrl !== 'string' || !req.body.photoDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Chiqindi fotosuratini yuklash yoki suratga olish majburiy.' });
    }

    let photoStorageKey: string;
    try {
      photoStorageKey = await processAndStoreReportPhoto(req.body.photoDataUrl);
    } catch (photoErr) {
      return res.status(400).json({
        error: photoErr instanceof Error ? photoErr.message : 'Rasmni qayta ishlashda xatolik.',
      });
    }

    const estimates = await getConfiguredVolumeEstimates();
    const estimatedLiters = estimates[parsed.data.estimatedRange] ?? 45;
    const publicCode = generatePublicReportCode();

    const created = await db.transaction(async (tx) => {
      const [report] = await tx
        .insert(wasteReports)
        .values({
          publicCode,
          citizenId: u.id,
          districtId: u.districtId!,
          mfyId: u.mfyId!,
          category: parsed.data.category,
          estimatedRange: parsed.data.estimatedRange,
          estimatedLiters,
          description: parsed.data.description,
          address: parsed.data.address,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
          photoStorageKey,
          status: 'submitted',
        })
        .returning();

      await tx.insert(reportStatusEvents).values({
        reportId: report.id,
        status: 'submitted',
        actorUserId: u.id,
        note: 'Murojaat fuqaro tomonidan yuborildi (foydalanuvchi taxmini).',
      });

      // Notify drivers assigned to this MFY
      const assigned = await tx
        .select({ userId: drivers.userId })
        .from(driverAssignments)
        .innerJoin(drivers, eq(driverAssignments.driverId, drivers.id))
        .where(
          and(
            eq(driverAssignments.mfyId, u.mfyId!),
            eq(driverAssignments.isActive, true),
            eq(drivers.approvalStatus, 'approved')
          )
        );

      for (const drv of assigned) {
        await createNotificationTx(tx, {
          userId: drv.userId,
          type: 'new_report',
          title: 'Yangi chiqindi murojaati',
          body: `${parsed.data.category} (${parsed.data.estimatedRange}) bo‘yicha yangi murojaat kelib tushdi.`,
          relatedEntityType: 'report',
          relatedEntityId: String(report.id),
        });
      }

      return { report, notifiedDriverUserIds: assigned.map((d) => d.userId) };
    });

    emitAfterCommit({
      keys: ['citizen-dashboard', 'citizen-reports', 'driver-mfys', 'driver-dashboard', 'admin-reports'],
      userIds: [u.id, ...created.notifiedDriverUserIds],
      includeAdmins: true,
    });

    return res.status(201).json({
      message: 'Murojaatingiz muvaffaqiyatli yuborildi!',
      report: created.report,
    });
  } catch (err) {
    console.error('Create report error:', err);
    return res.status(500).json({ error: 'Murojaatni yuborishda server xatoligi yuz berdi.' });
  }
});

citizenRouter.get('/citizen/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const conditions = [eq(wasteReports.citizenId, u.id)];

    if (typeof req.query.status === 'string' && req.query.status && req.query.status !== 'all') {
      conditions.push(eq(wasteReports.status, req.query.status));
    }
    if (typeof req.query.category === 'string' && req.query.category && req.query.category !== 'all') {
      conditions.push(eq(wasteReports.category, req.query.category));
    }
    if (typeof req.query.dateFrom === 'string' && req.query.dateFrom) {
      conditions.push(gte(wasteReports.createdAt, new Date(`${req.query.dateFrom}T00:00:00+05:00`)));
    }
    if (typeof req.query.dateTo === 'string' && req.query.dateTo) {
      conditions.push(lte(wasteReports.createdAt, new Date(`${req.query.dateTo}T23:59:59+05:00`)));
    }

    const list = await db
      .select()
      .from(wasteReports)
      .where(and(...conditions))
      .orderBy(desc(wasteReports.createdAt));

    return res.json({ reports: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Murojaatlar ro‘yxatini yuklashda xatolik.' });
  }
});

citizenRouter.get('/citizen/reports/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Noto‘g‘ri ID.' });

    const [report] = await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1);
    if (!report) return res.status(404).json({ error: 'Murojaat topilmadi.' });

    // Strict ownership check (citizen only sees own reports; admin sees all)
    if (req.currentUser!.role !== 'admin' && report.citizenId !== req.currentUser!.id) {
      return res.status(403).json({ error: 'Ushbu murojaatni ko‘rish huquqingiz yo‘q.' });
    }

    const events = await db
      .select({
        id: reportStatusEvents.id,
        status: reportStatusEvents.status,
        note: reportStatusEvents.note,
        createdAt: reportStatusEvents.createdAt,
        actorName: users.fullName,
      })
      .from(reportStatusEvents)
      .leftJoin(users, eq(reportStatusEvents.actorUserId, users.id))
      .where(eq(reportStatusEvents.reportId, report.id))
      .orderBy(reportStatusEvents.createdAt);

    const reportDisputes = await db
      .select()
      .from(disputes)
      .where(eq(disputes.reportId, report.id))
      .orderBy(desc(disputes.createdAt));

    return res.json({ report, timeline: events, disputes: reportDisputes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Murojaat tafsilotlarini yuklashda xatolik.' });
  }
});

citizenRouter.post('/citizen/reports/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [report] = await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1);
    if (!report || report.citizenId !== req.currentUser!.id) {
      return res.status(404).json({ error: 'Murojaat topilmadi.' });
    }

    if (!CANCELLABLE_REPORT_STATUSES.has(report.status as ReportStatus)) {
      return res.status(400).json({
        error: 'Ushbu holatdagi murojaatni bekor qilib bo‘lmaydi.',
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(wasteReports)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(wasteReports.id, report.id));

      await tx.insert(reportStatusEvents).values({
        reportId: report.id,
        status: 'cancelled',
        actorUserId: req.currentUser!.id,
        note: 'Fuqaro tomonidan bekor qilindi.',
      });
    });

    emitAfterCommit({
      keys: ['citizen-reports', 'citizen-dashboard', 'driver-mfys'],
      userIds: [req.currentUser!.id],
      includeAdmins: true,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Murojaatni bekor qilishda xatolik.' });
  }
});

citizenRouter.post('/citizen/reports/:id/dispute', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = disputeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message });
    }

    const [report] = await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1);
    if (!report || report.citizenId !== req.currentUser!.id) {
      return res.status(404).json({ error: 'Murojaat topilmadi.' });
    }

    const [created] = await db
      .insert(disputes)
      .values({
        reportId: report.id,
        citizenId: req.currentUser!.id,
        reason: parsed.data.reason,
        status: 'open',
      })
      .returning();

    emitAfterCommit({ keys: ['admin-reports'], includeAdmins: true });
    return res.status(201).json({ dispute: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'E’tiroz yuborishda xatolik yuz berdi.' });
  }
});

// ============================================================
// PRIVATE PHOTO SERVING (Authorized Access Only)
// ============================================================

citizenRouter.get('/storage/reports/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).send('Invalid ID');

    const [report] = await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1);
    if (!report || !report.photoStorageKey) {
      return res.status(404).send('Not found');
    }

    const u = req.currentUser!;
    let authorized = u.role === 'admin' || report.citizenId === u.id;

    if (!authorized && u.role === 'driver' && u.driverId) {
      const [assignment] = await db
        .select({ id: driverAssignments.id })
        .from(driverAssignments)
        .where(
          and(
            eq(driverAssignments.driverId, u.driverId),
            eq(driverAssignments.mfyId, report.mfyId),
            eq(driverAssignments.isActive, true)
          )
        )
        .limit(1);
      authorized = Boolean(assignment);
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Ushbu rasmga kirish huquqingiz yo‘q.' });
    }

    const safeName = path.basename(report.photoStorageKey);
    const fullPath = path.join(PRIVATE_REPORTS_DIR, safeName);
    const fileBuf = await fs.readFile(fullPath);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(fileBuf);
  } catch {
    return res.status(404).send('Photo unavailable');
  }
});

// ============================================================
// PERSONAL ECO ID QR (Opaque 256-bit credential, digest only, 10m expiry)
// ============================================================

const QR_TTL_MS = 10 * 60 * 1000; // 10 minutes

citizenRouter.post('/citizen/qr/rotate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const opaqueToken = generateOpaqueToken(32); // 256 bits entropy, zero personal data
    const digest = sha256Hex(opaqueToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QR_TTL_MS);

    await db.transaction(async (tx) => {
      // Invalidate all previous active credentials
      await tx
        .update(qrCredentials)
        .set({ revokedAt: now })
        .where(and(eq(qrCredentials.userId, u.id), isNull(qrCredentials.revokedAt)));

      await tx.insert(qrCredentials).values({
        userId: u.id,
        tokenDigest: digest,
        expiresAt,
      });
    });

    return res.json({
      qrPayload: opaqueToken,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: Math.floor(QR_TTL_MS / 1000),
    });
  } catch (err) {
    console.error('QR rotate error:', err);
    return res.status(500).json({ error: 'QR kodni yaratishda xatolik yuz berdi.' });
  }
});

citizenRouter.post('/citizen/qr/revoke', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    await db
      .update(qrCredentials)
      .set({ revokedAt: new Date() })
      .where(and(eq(qrCredentials.userId, u.id), isNull(qrCredentials.revokedAt)));

    return res.json({ ok: true, revoked: true });
  } catch (err) {
    console.error('QR revoke error:', err);
    return res.status(500).json({ error: 'QR kodni bekor qilishda xatolik.' });
  }
});

// ============================================================
// CITIZEN MAP (Authorized MFY Drivers Only)
// ============================================================

citizenRouter.get('/citizen/map', requireAuth, async (req: AuthRequest, res) => {
  try {
    await purgeAbandonedLocations();
    const u = req.currentUser!;

    if (!u.mfyId) {
      return res.json({ drivers: [], pickups: [] });
    }

    // Only drivers with an active trip in the citizen's MFY AND active assignment
    const activeDriverLocs = await db
      .select({
        tripId: driverLocations.tripId,
        driverId: driverLocations.driverId,
        latitude: driverLocations.latitude,
        longitude: driverLocations.longitude,
        accuracyMeters: driverLocations.accuracyMeters,
        receivedAt: driverLocations.receivedAt,
        driverName: users.fullName,
        driverPhone: users.phone,
        vehiclePlate: drivers.vehiclePlate,
        tripStartedAt: driverTrips.startedAt,
      })
      .from(driverLocations)
      .innerJoin(driverTrips, eq(driverLocations.tripId, driverTrips.id))
      .innerJoin(drivers, eq(driverLocations.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .innerJoin(
        driverAssignments,
        and(
          eq(driverAssignments.driverId, drivers.id),
          eq(driverAssignments.mfyId, u.mfyId),
          eq(driverAssignments.isActive, true)
        )
      )
      .where(and(eq(driverLocations.mfyId, u.mfyId), eq(driverTrips.status, 'active')));

    const nowMs = Date.now();
    const visibleDrivers = activeDriverLocs.map((d) => ({
      tripId: d.tripId,
      driverId: d.driverId,
      driverName: d.driverName,
      driverPhone: d.driverPhone || undefined,
      vehiclePlate: d.vehiclePlate,
      latitude: d.latitude,
      longitude: d.longitude,
      accuracyMeters: d.accuracyMeters,
      receivedAt: d.receivedAt.toISOString(),
      isStale: isLocationStale(d.receivedAt.getTime(), nowMs),
      etaLabel: 'Yetib kelish vaqti aniqlanmoqda.',
    }));

    const myPickups = await db
      .select({
        id: wasteReports.id,
        publicCode: wasteReports.publicCode,
        category: wasteReports.category,
        estimatedRange: wasteReports.estimatedRange,
        status: wasteReports.status,
        address: wasteReports.address,
        latitude: wasteReports.latitude,
        longitude: wasteReports.longitude,
      })
      .from(wasteReports)
      .where(
        and(
          eq(wasteReports.citizenId, u.id),
          inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived'])
        )
      );

    return res.json({
      drivers: visibleDrivers,
      pickups: myPickups.filter((p) => p.latitude !== null && p.longitude !== null),
    });
  } catch (err) {
    console.error('Citizen map error:', err);
    return res.status(500).json({ error: 'Xarita ma’lumotlarini yuklashda xatolik.' });
  }
});

// ============================================================
// QUESTS (Server-Side Answer Validation, No Secret Leak)
// ============================================================

citizenRouter.get('/citizen/quests', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const todayTashkent = getTashkentDateString(new Date());

    const allActiveQuests = await db
      .select({
        id: quests.id,
        templateCode: quests.templateCode,
        title: quests.title,
        description: quests.description,
        questType: quests.questType,
        xpReward: quests.xpReward,
        coinReward: quests.coinReward,
        questionText: quests.questionText,
        optionsJson: quests.optionsJson,
        // NEVER return correctOptionIndex to the client!
      })
      .from(quests)
      .where(eq(quests.isActive, true))
      .orderBy(quests.id);

    const { selected: todaysQuests } = selectTodayQuests(allActiveQuests, todayTashkent);

    const completions = await db
      .select({ questId: questCompletions.questId })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, u.id),
          eq(questCompletions.localDateTashkent, todayTashkent)
        )
      );

    const completedSet = new Set(completions.map((c) => c.questId));

    return res.json({
      localDateTashkent: todayTashkent,
      quests: todaysQuests.map((q) => ({
        id: q.id,
        templateCode: q.templateCode,
        title: q.title,
        description: q.description,
        questType: q.questType,
        xpReward: q.xpReward,
        coinReward: q.coinReward,
        questionText: q.questionText,
        options: q.optionsJson ? (JSON.parse(q.optionsJson) as string[]) : null,
        quizDayNumber: q.quizDayNumber ?? null,
        quizTotalCount: q.quizTotalCount ?? null,
        completedToday: completedSet.has(q.id),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Topshiriqlarni yuklashda xatolik.' });
  }
});

citizenRouter.post('/citizen/quests/:id/submit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const questId = Number(req.params.id);
    const u = req.currentUser!;
    const todayTashkent = getTashkentDateString(new Date());

    const [quest] = await db
      .select()
      .from(quests)
      .where(and(eq(quests.id, questId), eq(quests.isActive, true)))
      .limit(1);

    if (!quest) {
      return res.status(404).json({ error: 'Topshiriq topilmadi.' });
    }

    const [already] = await db
      .select()
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, u.id),
          eq(questCompletions.questId, quest.id),
          eq(questCompletions.localDateTashkent, todayTashkent)
        )
      )
      .limit(1);

    if (already) {
      return res.status(409).json({ error: 'Ushbu kundalik topshiriq bugun allaqachon bajarilgan.' });
    }

    if (quest.questType === 'report') {
      return res.status(400).json({
        error: 'Ushbu topshiriq tasdiqlangan chiqindi murojaati orqali bajariladi.',
      });
    }

    if (quest.questType === 'quiz') {
      const allQuizRows = await db
        .select({
          id: quests.id,
          templateCode: quests.templateCode,
          questType: quests.questType,
        })
        .from(quests)
        .where(and(eq(quests.isActive, true), eq(quests.questType, 'quiz')));
      const { todaysQuizId } = selectTodayQuests(allQuizRows, todayTashkent);
      if (todaysQuizId !== quest.id) {
        return res.status(403).json({
          error: 'Ushbu viktorina savoli bugungi kunga mo‘ljallanmagan.',
        });
      }
    }

    const selectedOptionIndex = Number(req.body?.selectedOptionIndex);
    if (!Number.isInteger(selectedOptionIndex) || selectedOptionIndex < 0) {
      return res.status(400).json({ error: 'Javob variantini tanlang.' });
    }

    const isCorrect = quest.correctOptionIndex === selectedOptionIndex;

    const result = await db.transaction(async (tx) => {
      await tx.insert(questSubmissions).values({
        questId: quest.id,
        userId: u.id,
        localDateTashkent: todayTashkent,
        selectedOptionIndex,
        isCorrect,
      });

      if (!isCorrect) {
        return { isCorrect: false, xpGranted: 0, coinsGranted: 0 };
      }

      const eventKey = `quest:${quest.id}:user:${u.id}:date:${todayTashkent}`;
      const [comp] = await tx
        .insert(questCompletions)
        .values({
          questId: quest.id,
          userId: u.id,
          localDateTashkent: todayTashkent,
          eventKey,
        })
        .onConflictDoNothing()
        .returning({ id: questCompletions.id });

      if (!comp) {
        return { isCorrect: true, xpGranted: 0, coinsGranted: 0 };
      }

      const ruleCode = quest.questType === 'participation' ? 'participation' : 'daily_quiz';
      const rule = await getRewardRule(ruleCode);

      const award = await awardXpAndCoinsTx(tx, {
        userId: u.id,
        eventKey,
        sourceType: ruleCode,
        sourceId: String(quest.id),
        xpAmount: quest.xpReward || rule.xpAmount,
        coinAmount: quest.coinReward || rule.coinAmount,
        description: `Topshiriq bajarildi: ${quest.title}`,
      });

      await createNotificationTx(tx, {
        userId: u.id,
        type: 'quest_completed',
        title: `${quest.title} bajarildi!`,
        body: `+${award.xpGranted} XP va +${award.coinsGranted} Eco Ball hisobingizga qo‘shildi.`,
        relatedEntityType: 'quest',
        relatedEntityId: String(quest.id),
      });

      return { isCorrect: true, xpGranted: award.xpGranted, coinsGranted: award.coinsGranted };
    });

    if (!result.isCorrect) {
      return res.json({
        correct: false,
        message: 'Javob noto‘g‘ri. Yana bir bor o‘ylab ko‘ring.',
      });
    }

    emitAfterCommit({
      keys: ['citizen-dashboard', 'citizen-quests', 'citizen-leaderboard', 'citizen-wallet', 'notifications'],
      userIds: [u.id],
    });

    return res.json({
      correct: true,
      xpGranted: result.xpGranted,
      coinsGranted: result.coinsGranted,
      message: `To‘g‘ri javob! +${result.xpGranted} XP va +${result.coinsGranted} Eco Ball berildi.`,
    });
  } catch (err) {
    console.error('Quest submit error:', err);
    return res.status(500).json({ error: 'Javobni tekshirishda xatolik yuz berdi.' });
  }
});

// ============================================================
// LEADERBOARD (Opted-in Public Names, District-Scoped, Ledger Totals)
// ============================================================

citizenRouter.get('/citizen/leaderboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const period = typeof req.query.period === 'string' ? req.query.period : 'all';
    const districtId = Number(req.query.districtId) || u.districtId;

    if (!districtId) {
      return res.json({ entries: [], period, districtId: null });
    }

    const todayStr = getTashkentDateString(new Date());
    let minDateStr: string | null = null;
    if (period === 'today') minDateStr = todayStr;
    else if (period === 'week') minDateStr = addDaysToDateString(todayStr, -6);
    else if (period === 'month') minDateStr = addDaysToDateString(todayStr, -29);

    const joinCond = minDateStr
      ? and(eq(xpLedger.userId, users.id), gte(xpLedger.localDateTashkent, minDateStr))
      : eq(xpLedger.userId, users.id);

    const rows = await db
      .select({
        userId: users.id,
        displayName: users.publicLeaderboardName,
        fullName: users.fullName,
        xp: sql<number>`coalesce(sum(${xpLedger.xpAmount}), 0)::int`,
      })
      .from(users)
      .leftJoin(xpLedger, joinCond)
      .where(
        and(
          eq(users.districtId, districtId),
          eq(users.role, 'citizen'),
          eq(users.leaderboardVisible, true),
          eq(users.accountStatus, 'active')
        )
      )
      .groupBy(users.id)
      .orderBy(desc(sql`coalesce(sum(${xpLedger.xpAmount}), 0)`), users.id)
      .limit(100);

    const entries = rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      displayName: r.displayName || r.fullName.split(' ')[0] || 'Fuqaro',
      xp: r.xp,
      isCurrentUser: r.userId === u.id,
    }));

    return res.json({ entries, period, districtId });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Reytingni yuklashda xatolik.' });
  }
});

// ============================================================
// ECO MARKET & WALLET (Transactional Row-Lock Redemption)
// ============================================================

citizenRouter.get('/citizen/market', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(marketRewards)
      .where(eq(marketRewards.isActive, true))
      .orderBy(marketRewards.coinCost);

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, req.currentUser!.id))
      .limit(1);

    return res.json({
      rewards: items,
      coinBalance: wallet?.coinBalance ?? 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Eco Market mahsulotlarini yuklashda xatolik.' });
  }
});

citizenRouter.post('/citizen/market/redeem', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const rewardId = Number(req.body?.rewardId);
    const idempotencyKey =
      typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim().length >= 8
        ? req.body.idempotencyKey.trim().slice(0, 128)
        : '';

    if (!Number.isInteger(rewardId) || rewardId <= 0) {
      return res.status(400).json({ error: 'Sovrin tanlanmagan.' });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'So‘rov identifikatori (idempotencyKey) talab etiladi.' });
    }

    const result = await db.transaction(async (tx) => {
      // Idempotency check first
      const [existingRedemption] = await tx
        .select()
        .from(redemptions)
        .where(eq(redemptions.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existingRedemption) {
        return { redemption: existingRedemption, duplicate: true };
      }

      // Ensure wallet exists, then lock wallet row FOR UPDATE
      await tx.insert(wallets).values({ userId: u.id }).onConflictDoNothing();
      const lockedWallets = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, u.id))
        .for('update');
      const wallet = lockedWallets[0];

      // Lock reward row FOR UPDATE and read authoritative DB price & stock
      const lockedRewards = await tx
        .select()
        .from(marketRewards)
        .where(and(eq(marketRewards.id, rewardId), eq(marketRewards.isActive, true)))
        .for('update');
      const reward = lockedRewards[0];

      if (!reward) {
        throw new Error('NOT_FOUND:Tanlangan sovrin mavjud emas yoki faol emas.');
      }
      if (reward.stockQuantity <= 0) {
        throw new Error('OUT_OF_STOCK:Ushbu sovrin omborda qolmagan.');
      }
      if (wallet.coinBalance < reward.coinCost) {
        throw new Error('INSUFFICIENT_FUNDS:Eco Ballaringiz yetarli emas.');
      }

      // Reserve inventory
      await tx
        .update(marketRewards)
        .set({ stockQuantity: reward.stockQuantity - 1, updatedAt: new Date() })
        .where(eq(marketRewards.id, reward.id));

      // Create redemption record with DB price snapshot
      const [redemption] = await tx
        .insert(redemptions)
        .values({
          userId: u.id,
          rewardId: reward.id,
          idempotencyKey,
          coinCostSnapshot: reward.coinCost,
          status: 'pending',
          fulfillmentNote: reward.fulfillmentConditions,
        })
        .returning();

      await tx.insert(inventoryEvents).values({
        rewardId: reward.id,
        redemptionId: redemption.id,
        delta: -1,
        reason: 'redemption_reserved',
        actorUserId: u.id,
      });

      // Deduct coins via ledger + update wallet
      const coinEventKey = `redemption:${redemption.id}:debit`;
      await tx.insert(coinLedger).values({
        userId: u.id,
        eventKey: coinEventKey,
        sourceType: 'redemption',
        sourceId: String(redemption.id),
        coinAmount: -reward.coinCost,
        description: `Eco Market almashtirish: ${reward.title}`,
      });

      await tx
        .update(wallets)
        .set({
          coinBalance: wallet.coinBalance - reward.coinCost,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, u.id));

      await createNotificationTx(tx, {
        userId: u.id,
        type: 'redemption_created',
        title: 'Buyurtma qabul qilindi',
        body: `“${reward.title}” uchun ${reward.coinCost} Eco Ball sarflandi.`,
        relatedEntityType: 'redemption',
        relatedEntityId: String(redemption.id),
      });

      return { redemption, duplicate: false };
    });

    emitAfterCommit({
      keys: ['citizen-market', 'citizen-wallet', 'citizen-dashboard', 'admin-redemptions', 'notifications'],
      userIds: [u.id],
      includeAdmins: true,
    });

    return res.status(result.duplicate ? 200 : 201).json({
      redemption: result.redemption,
      message: 'Eco Ballar muvaffaqiyatli almashtirildi!',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice(10) });
    if (msg.startsWith('OUT_OF_STOCK:') || msg.startsWith('INSUFFICIENT_FUNDS:')) {
      return res.status(400).json({ error: msg.split(':').slice(1).join(':') });
    }
    console.error('Redeem error:', err);
    return res.status(500).json({ error: 'Almashtirishda server xatoligi yuz berdi.' });
  }
});

citizenRouter.get('/citizen/wallet', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.currentUser!;
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, u.id)).limit(1);
    const ledger = await db
      .select()
      .from(coinLedger)
      .where(eq(coinLedger.userId, u.id))
      .orderBy(desc(coinLedger.createdAt))
      .limit(100);

    const myRedemptions = await db
      .select({
        id: redemptions.id,
        rewardId: redemptions.rewardId,
        rewardTitle: marketRewards.title,
        coinCostSnapshot: redemptions.coinCostSnapshot,
        status: redemptions.status,
        fulfillmentNote: redemptions.fulfillmentNote,
        createdAt: redemptions.createdAt,
        refundedAt: redemptions.refundedAt,
      })
      .from(redemptions)
      .innerJoin(marketRewards, eq(redemptions.rewardId, marketRewards.id))
      .where(eq(redemptions.userId, u.id))
      .orderBy(desc(redemptions.createdAt));

    return res.json({
      wallet: wallet ?? { coinBalance: 0, totalXp: 0, currentLevel: 1, currentStreak: 0, longestStreak: 0 },
      level: calculateLevelFromXp(wallet?.totalXp ?? 0),
      history: ledger,
      redemptions: myRedemptions,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Hamyon ma’lumotlarini yuklashda xatolik.' });
  }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

citizenRouter.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.currentUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return res.json({ notifications: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Bildirishnomalarni yuklashda xatolik.' });
  }
});

citizenRouter.post('/notifications/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.body?.id ? Number(req.body.id) : null;
    if (id && Number.isFinite(id)) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, req.currentUser!.id)));
    } else {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, req.currentUser!.id));
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Bildirishnomalarni belgilashda xatolik.' });
  }
});
