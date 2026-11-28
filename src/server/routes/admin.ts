import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { and, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  regions,
  districts,
  mfys,
  users,
  drivers,
  driverAssignments,
  driverTrips,
  driverLocations,
  wasteReports,
  reportStatusEvents,
  disputes,
  quests,
  ecoFacts,
  marketRewards,
  redemptions,
  inventoryEvents,
  rewardRules,
  auditLogs,
  systemSettings,
  wallets,
  coinLedger,
} from '../../db/schema.ts';
import {
  addDaysToDateString,
  aiQuestionSchema,
  calculateWorkload,
  cleanDisplayName,
  getTashkentDateString,
  isLocationStale,
  normalizeGeographyName,
} from '../../lib/domain.ts';
import { requireRole, type AuthRequest } from '../auth.ts';
import {
  awardXpAndCoinsTx,
  createNotificationTx,
  emitAfterCommit,
  getConfiguredVolumeEstimates,
  getRewardRule,
  purgeAbandonedLocations,
  recordAuditLogTx,
} from '../services.ts';

export const adminRouter = Router();

adminRouter.use('/admin', requireRole('admin'));

function parsePagination(query: Record<string, unknown>) {
  const pageSizeRaw = Number(query.pageSize ?? 25);
  const pageSize = [25, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 25;
  const pageRaw = Number(query.page ?? 1);
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function resolveAnalyticsRange(rangeParam: string, fromParam?: string, toParam?: string) {
  const todayStr = getTashkentDateString(new Date());
  let startStr = addDaysToDateString(todayStr, -6);
  let endStr = todayStr;
  let label = 'Oxirgi 7 kun';

  if (rangeParam === 'today') {
    startStr = todayStr;
    label = 'Bugun';
  } else if (rangeParam === '30d') {
    startStr = addDaysToDateString(todayStr, -29);
    label = 'Oxirgi 30 kun';
  } else if (rangeParam === '90d') {
    startStr = addDaysToDateString(todayStr, -89);
    label = 'Oxirgi 90 kun';
  } else if (rangeParam === 'custom' && fromParam && toParam) {
    startStr = fromParam;
    endStr = toParam;
    label = `${fromParam} — ${toParam}`;
  }

  return {
    startStr,
    endStr,
    label,
    startDate: new Date(`${startStr}T00:00:00+05:00`),
    endDate: new Date(`${endStr}T23:59:59+05:00`),
  };
}

// ============================================================
// OVERVIEW & ANALYTICS (Real DB Aggregations)
// ============================================================

adminRouter.get('/admin/analytics', async (req, res) => {
  try {
    const range = resolveAnalyticsRange(
      String(req.query.range ?? '7d'),
      typeof req.query.from === 'string' ? req.query.from : undefined,
      typeof req.query.to === 'string' ? req.query.to : undefined
    );

    const [citizensCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'citizen'));

    const [driversCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(drivers)
      .where(eq(drivers.approvalStatus, 'approved'));

    const [activeTripsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(driverTrips)
      .where(eq(driverTrips.status, 'active'));

    const [pendingMfysCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mfys)
      .where(eq(mfys.status, 'pending'));

    const [periodReports] = await db
      .select({
        totalReports: sql<number>`count(*)::int`,
        completedReports: sql<number>`count(*) filter (where ${wasteReports.status} = 'completed')::int`,
        pendingReports: sql<number>`count(*) filter (where ${wasteReports.status} in ('submitted','reviewing','assigned','en_route','arrived'))::int`,
        verifiedLiters: sql<number>`coalesce(sum(${wasteReports.actualLiters}) filter (where ${wasteReports.status} = 'completed'), 0)::float`,
      })
      .from(wasteReports)
      .where(and(gte(wasteReports.createdAt, range.startDate), lte(wasteReports.createdAt, range.endDate)));

    // Daily series from waste_reports grouped by Asia/Tashkent date
    const dailyRows = await db
      .select({
        day: sql<string>`to_char(${wasteReports.createdAt} AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')`,
        submitted: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${wasteReports.status} = 'completed')::int`,
        liters: sql<number>`coalesce(sum(${wasteReports.actualLiters}) filter (where ${wasteReports.status} = 'completed'), 0)::float`,
      })
      .from(wasteReports)
      .where(and(gte(wasteReports.createdAt, range.startDate), lte(wasteReports.createdAt, range.endDate)))
      .groupBy(sql`to_char(${wasteReports.createdAt} AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${wasteReports.createdAt} AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD')`);

    // Category distribution
    const categoryRows = await db
      .select({
        category: wasteReports.category,
        count: sql<number>`count(*)::int`,
        liters: sql<number>`coalesce(sum(coalesce(${wasteReports.actualLiters}, ${wasteReports.estimatedLiters})), 0)::float`,
      })
      .from(wasteReports)
      .where(and(gte(wasteReports.createdAt, range.startDate), lte(wasteReports.createdAt, range.endDate)))
      .groupBy(wasteReports.category)
      .orderBy(desc(sql`count(*)`));

    return res.json({
      range: { start: range.startStr, end: range.endStr, label: range.label },
      kpis: {
        citizensCount: citizensCount?.count ?? 0,
        approvedDriversCount: driversCount?.count ?? 0,
        activeTripsCount: activeTripsCount?.count ?? 0,
        pendingMfysCount: pendingMfysCount?.count ?? 0,
        totalReports: periodReports?.totalReports ?? 0,
        completedReports: periodReports?.completedReports ?? 0,
        pendingReports: periodReports?.pendingReports ?? 0,
        verifiedLiters: Math.round((periodReports?.verifiedLiters ?? 0) * 10) / 10,
      },
      dailySeries: dailyRows,
      categoryBreakdown: categoryRows,
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    return res.status(500).json({ error: 'Analitika ma’lumotlarini yuklashda xatolik.' });
  }
});

// ============================================================
// ADMIN LIVE MAP
// ============================================================

adminRouter.get('/admin/map', async (_req, res) => {
  try {
    await purgeAbandonedLocations();
    const activeDrivers = await db
      .select({
        tripId: driverLocations.tripId,
        driverId: driverLocations.driverId,
        driverName: users.fullName,
        vehiclePlate: drivers.vehiclePlate,
        mfyName: mfys.name,
        latitude: driverLocations.latitude,
        longitude: driverLocations.longitude,
        accuracyMeters: driverLocations.accuracyMeters,
        receivedAt: driverLocations.receivedAt,
      })
      .from(driverLocations)
      .innerJoin(driverTrips, eq(driverLocations.tripId, driverTrips.id))
      .innerJoin(drivers, eq(driverLocations.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .innerJoin(mfys, eq(driverLocations.mfyId, mfys.id))
      .where(eq(driverTrips.status, 'active'));

    const pendingPickups = await db
      .select({
        id: wasteReports.id,
        publicCode: wasteReports.publicCode,
        category: wasteReports.category,
        estimatedLiters: wasteReports.estimatedLiters,
        status: wasteReports.status,
        mfyName: mfys.name,
        latitude: wasteReports.latitude,
        longitude: wasteReports.longitude,
      })
      .from(wasteReports)
      .innerJoin(mfys, eq(wasteReports.mfyId, mfys.id))
      .where(inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived']));

    return res.json({
      drivers: activeDrivers.map((d) => ({
        ...d,
        receivedAt: d.receivedAt.toISOString(),
        isStale: isLocationStale(d.receivedAt.getTime()),
      })),
      pickups: pendingPickups.filter((p) => p.latitude !== null && p.longitude !== null),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Monitoring xaritasini yuklashda xatolik.' });
  }
});

// ============================================================
// DISTRICTS & MFY MANAGEMENT (Review, Threshold, Merge)
// ============================================================

adminRouter.get('/admin/districts', async (_req, res) => {
  const list = await db.select().from(districts).orderBy(districts.name);
  return res.json({ districts: list });
});

/** Remove (hide) a district. Blocked while it still has MFYs, so no data is orphaned. */
adminRouter.delete('/admin/districts/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [d] = await db.select().from(districts).where(eq(districts.id, id)).limit(1);
    if (!d) return res.status(404).json({ error: 'Tuman topilmadi.' });
    const [m] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(mfys)
      .where(and(eq(mfys.districtId, id), sql`${mfys.status} <> 'merged'`));
    if ((m?.c ?? 0) > 0) {
      return res.status(409).json({ error: `“${d.name}” tumanida ${m.c} ta MFY bor. Avval ularni boshqa tumanga birlashtiring yoki o‘chiring.` });
    }
    await db.transaction(async (tx) => {
      await tx.update(districts).set({ isActive: false }).where(eq(districts.id, id));
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'district_removed',
        targetType: 'district',
        targetId: String(id),
        metadata: { name: d.name },
      });
    });
    emitAfterCommit({ keys: ['districts', 'admin-districts'], includeAdmins: true });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Tumanni o‘chirishda xatolik.' });
  }
});

adminRouter.post('/admin/districts/:id/restore', async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  await db.update(districts).set({ isActive: true }).where(eq(districts.id, id));
  emitAfterCommit({ keys: ['districts', 'admin-districts'], includeAdmins: true });
  return res.json({ ok: true });
});

adminRouter.post('/admin/districts', async (req: AuthRequest, res) => {
  try {
    const name = cleanDisplayName(String(req.body?.name ?? ''));
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Tuman nomi 2–100 belgidan iborat bo‘lishi kerak.' });
    }
    const [region] = await db.select().from(regions).limit(1);
    if (!region) return res.status(400).json({ error: 'Viloyat topilmadi.' });

    const norm = normalizeGeographyName(name);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(districts)
        .values({ regionId: region.id, name, normalizedName: norm, isActive: true })
        .returning();
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'district_created',
        targetType: 'district',
        targetId: String(row.id),
        metadata: { name },
      });
      return row;
    });
    return res.status(201).json({ district: created });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return res.status(409).json({ error: 'Bunday tuman allaqachon mavjud.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Tumanni saqlashda xatolik.' });
  }
});

adminRouter.post('/admin/mfys', async (req: AuthRequest, res) => {
  try {
    const name = cleanDisplayName(String(req.body?.name ?? ''));
    const districtId = Number(req.body?.districtId);
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'MFY nomi 2–100 belgidan iborat bo‘lishi kerak.' });
    }
    if (!Number.isInteger(districtId) || districtId <= 0) {
      return res.status(400).json({ error: 'Tumanni tanlang.' });
    }
    const [district] = await db.select({ id: districts.id }).from(districts).where(eq(districts.id, districtId)).limit(1);
    if (!district) return res.status(404).json({ error: 'Tuman topilmadi.' });

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(mfys)
        .values({ districtId, name, normalizedName: normalizeGeographyName(name), status: 'approved' })
        .returning();
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'mfy_created',
        targetType: 'mfy',
        targetId: String(row.id),
        metadata: { name, districtId },
      });
      return row;
    });
    emitAfterCommit({ keys: ['mfys', 'admin-mfys', 'driver-mfys'], includeAdmins: true });
    return res.status(201).json({ mfy: created });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return res.status(409).json({ error: 'Bu tumanda shu nomli MFY allaqachon mavjud.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'MFYni saqlashda xatolik.' });
  }
});

adminRouter.get('/admin/mfys', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: mfys.id,
        districtId: mfys.districtId,
        districtName: districts.name,
        name: mfys.name,
        status: mfys.status,
        workloadThresholdLiters: mfys.workloadThresholdLiters,
        mergedIntoId: mfys.mergedIntoId,
        createdAt: mfys.createdAt,
      })
      .from(mfys)
      .innerJoin(districts, eq(mfys.districtId, districts.id))
      .where(sql`${mfys.status} <> 'merged'`)
      .orderBy(desc(mfys.status), mfys.name);

    const pendingAggs = await db
      .select({
        mfyId: wasteReports.mfyId,
        pendingLiters: sql<number>`coalesce(sum(${wasteReports.estimatedLiters}), 0)::int`,
        pendingCount: sql<number>`count(*)::int`,
      })
      .from(wasteReports)
      .where(inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived']))
      .groupBy(wasteReports.mfyId);

    const aggMap = new Map(pendingAggs.map((a) => [a.mfyId, a]));

    return res.json({
      mfys: rows.map((m) => {
        const a = aggMap.get(m.id);
        const wl = calculateWorkload(a?.pendingLiters ?? 0, m.workloadThresholdLiters);
        return {
          ...m,
          pendingCount: a?.pendingCount ?? 0,
          ...wl,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'MFYlar ro‘yxatini yuklashda xatolik.' });
  }
});

adminRouter.patch('/admin/mfys/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.status === 'approved' || req.body?.status === 'pending') {
      updates.status = req.body.status;
    }
    if (req.body?.workloadThresholdLiters !== undefined) {
      const th = Number(req.body.workloadThresholdLiters);
      if (!Number.isInteger(th) || th <= 0) {
        return res.status(400).json({ error: 'Yuklama chegarasi musbat butun son bo‘lishi kerak.' });
      }
      updates.workloadThresholdLiters = th;
    }
    if (req.body?.name !== undefined) {
      const name = cleanDisplayName(String(req.body.name ?? ''));
      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'MFY nomi 2–100 belgidan iborat bo‘lishi kerak.' });
      }
      updates.name = name;
      updates.normalizedName = normalizeGeographyName(name);
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(mfys).set(updates).where(eq(mfys.id, id)).returning();
      if (!row) return null;
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'mfy_updated',
        targetType: 'mfy',
        targetId: String(id),
        metadata: updates,
      });
      return row;
    });

    if (!updated) return res.status(404).json({ error: 'MFY topilmadi.' });
    emitAfterCommit({ keys: ['mfys', 'admin-mfys', 'driver-mfys'], includeAdmins: true });
    return res.json({ mfy: updated });
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return res.status(409).json({ error: 'Bu tumanda shu nomli MFY allaqachon mavjud.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'MFYni yangilashda xatolik.' });
  }
});

adminRouter.post('/admin/mfys/:id/merge', async (req: AuthRequest, res) => {
  try {
    const sourceId = Number(req.params.id);
    const targetId = Number(req.body?.targetMfyId);
    if (!Number.isInteger(targetId) || sourceId === targetId) {
      return res.status(400).json({ error: 'Birlashtirish uchun boshqa maqsad MFYni tanlang.' });
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ mfyId: targetId }).where(eq(users.mfyId, sourceId));
      await tx.update(wasteReports).set({ mfyId: targetId }).where(eq(wasteReports.mfyId, sourceId));
      await tx
        .update(mfys)
        .set({ status: 'merged', mergedIntoId: targetId, updatedAt: new Date() })
        .where(eq(mfys.id, sourceId));

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'mfy_merged',
        targetType: 'mfy',
        targetId: String(sourceId),
        metadata: { targetMfyId: targetId },
      });
    });

    emitAfterCommit({ keys: ['mfys', 'admin-mfys', 'driver-mfys'], includeAdmins: true });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'MFYlarni birlashtirishda xatolik.' });
  }
});

// ============================================================
// DRIVERS & ASSIGNMENTS
// ============================================================

adminRouter.get('/admin/drivers', async (_req, res) => {
  try {
    const list = await db
      .select({
        id: drivers.id,
        userId: drivers.userId,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        approvalStatus: drivers.approvalStatus,
        vehiclePlate: drivers.vehiclePlate,
        vehicleConfirmed: sql<boolean>`drivers.vehicle_confirmed_at IS NOT NULL`,
        vehicleCapacityLiters: drivers.vehicleCapacityLiters,
        createdAt: drivers.createdAt,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .where(sql`${users.role} <> 'admin'`)
      .orderBy(desc(drivers.createdAt));

    const assigns = await db
      .select({
        driverId: driverAssignments.driverId,
        mfyId: driverAssignments.mfyId,
        mfyName: mfys.name,
      })
      .from(driverAssignments)
      .innerJoin(mfys, eq(driverAssignments.mfyId, mfys.id))
      .where(eq(driverAssignments.isActive, true));

    return res.json({
      drivers: list.map((d) => ({
        ...d,
        assignedMfys: assigns.filter((a) => a.driverId === d.id),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Haydovchilarni yuklashda xatolik.' });
  }
});


/** Normalizes an Uzbek vehicle plate ("01 A 123 BC" / "01 123 ABC"). Returns null if invalid. */
function normalizePlate(raw: unknown): string | null {
  const v = String(raw ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (v.length < 5 || v.length > 16 || !/^[0-9A-Z ]+$/.test(v) || !/[0-9]/.test(v)) return null;
  return v;
}
const PLATE_ERROR = 'Avtomobil raqamini to‘g‘ri kiriting (masalan: 50 A 123 BC).';

adminRouter.patch('/admin/drivers/:id', async (req: AuthRequest, res, next) => {
  // Only handles vehicle number changes; status changes (suspend/approve) go to the next handler.
  if (req.body?.vehiclePlate === undefined) return next();
  const plate = normalizePlate(req.body?.vehiclePlate);
  if (!plate) return res.status(400).json({ error: PLATE_ERROR });
  try {
    const id = Number(req.params.id);
    const [row] = await db.update(drivers).set({ vehiclePlate: plate }).where(eq(drivers.id, id)).returning({ id: drivers.id });
    if (!row) return res.status(404).json({ error: 'Haydovchi topilmadi.' });
    await recordAuditLogTx(db as never, {
      actorUserId: req.currentUser!.id,
      actorRole: 'admin',
      action: 'driver_vehicle_updated',
      targetType: 'driver',
      targetId: String(id),
      metadata: { vehiclePlate: plate },
    });
    emitAfterCommit({ keys: ['admin-drivers', 'driver-dashboard'], includeAdmins: true });
    return res.json({ vehiclePlate: plate });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Avtomobil raqamini saqlashda xatolik.' });
  }
});

adminRouter.post('/admin/drivers/promote', async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.body?.userId);
    const vehiclePlate = String(req.body?.vehiclePlate ?? '50 A 000 AA').trim().slice(0, 32);
    const vehicleCapacityLiters = Math.max(500, Number(req.body?.vehicleCapacityLiters ?? 4000));

    const created = await db.transaction(async (tx) => {
      const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u) throw new Error('Foydalanuvchi topilmadi.');

      await tx
        .update(users)
        .set({ role: 'driver', onboardingCompleted: true, updatedAt: new Date() })
        .where(eq(users.id, userId));

      const [drv] = await tx
        .insert(drivers)
        .values({
          userId,
          approvalStatus: 'approved',
          vehiclePlate,
          vehicleCapacityLiters,
          approvedBy: req.currentUser!.id,
          approvedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: drivers.userId,
          set: { approvalStatus: 'approved', vehiclePlate, vehicleCapacityLiters, updatedAt: new Date() },
        })
        .returning();

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'driver_promoted',
        targetType: 'driver',
        targetId: String(drv.id),
        metadata: { userId, vehiclePlate },
      });

      return drv;
    });

    return res.status(201).json({ driver: created });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Haydovchi tayinlashda xatolik.' });
  }
});

adminRouter.patch('/admin/drivers/:id', async (req: AuthRequest, res) => {
  try {
    const driverId = Number(req.params.id);
    const status = req.body?.approvalStatus;
    if (!['approved', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Noto‘g‘ri holat.' });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(drivers)
        .set({
          approvalStatus: status,
          approvedBy: status === 'approved' ? req.currentUser!.id : undefined,
          approvedAt: status === 'approved' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, driverId));

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: `driver_${status}`,
        targetType: 'driver',
        targetId: String(driverId),
        metadata: { approvalStatus: status },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Haydovchi holatini yangilashda xatolik.' });
  }
});

adminRouter.post('/admin/drivers/:id/assignments', async (req: AuthRequest, res) => {
  try {
    const driverId = Number(req.params.id);
    const mfyIds = Array.isArray(req.body?.mfyIds) ? req.body.mfyIds.map(Number).filter(Number.isInteger) : [];

    await db.transaction(async (tx) => {
      await tx
        .update(driverAssignments)
        .set({ isActive: false })
        .where(eq(driverAssignments.driverId, driverId));

      for (const mfyId of mfyIds) {
        await tx
          .insert(driverAssignments)
          .values({
            driverId,
            mfyId,
            assignedBy: req.currentUser!.id,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [driverAssignments.driverId, driverAssignments.mfyId],
            set: { isActive: true, assignedBy: req.currentUser!.id },
          });
      }

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'driver_assignments_updated',
        targetType: 'driver',
        targetId: String(driverId),
        metadata: { mfyIds },
      });
    });

    emitAfterCommit({ keys: ['driver-mfys', 'admin-drivers'], includeAdmins: true });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'MFY biriktirishda xatolik.' });
  }
});

// ============================================================
// CITIZENS (Paginated 25/50/100 with true total count)
// ============================================================

adminRouter.get('/admin/citizens', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'citizen'));

    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        accountStatus: users.accountStatus,
        districtName: districts.name,
        mfyName: mfys.name,
        totalXp: wallets.totalXp,
        coinBalance: wallets.coinBalance,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(districts, eq(users.districtId, districts.id))
      .leftJoin(mfys, eq(users.mfyId, mfys.id))
      .leftJoin(wallets, eq(users.id, wallets.userId))
      .where(eq(users.role, 'citizen'))
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset);

    return res.json({
      citizens: rows,
      total: countRow?.total ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Fuqarolarni yuklashda xatolik.' });
  }
});

adminRouter.patch('/admin/citizens/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.accountStatus;
    if (status !== 'active' && status !== 'suspended') {
      return res.status(400).json({ error: 'Noto‘g‘ri holat.' });
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ accountStatus: status, updatedAt: new Date() }).where(eq(users.id, id));
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: `citizen_${status}`,
        targetType: 'user',
        targetId: String(id),
        metadata: { accountStatus: status },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Fuqaro holatini yangilashda xatolik.' });
  }
});

// ============================================================
// REPORTS & DISPUTES (Explicit Report Reward Approval)
// ============================================================

adminRouter.get('/admin/reports', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(wasteReports);

    const rows = await db
      .select({
        id: wasteReports.id,
        moderationStatus: sql<string>`waste_reports.moderation_status`,
        aiVerdict: sql<string | null>`waste_reports.ai_verdict`,
        gpsAccuracy: sql<number | null>`waste_reports.gps_accuracy`,
        latitude: wasteReports.latitude,
        longitude: wasteReports.longitude,
        description: wasteReports.description,
        publicCode: wasteReports.publicCode,
        category: wasteReports.category,
        estimatedRange: wasteReports.estimatedRange,
        estimatedLiters: wasteReports.estimatedLiters,
        actualLiters: wasteReports.actualLiters,
        status: wasteReports.status,
        address: wasteReports.address,
        approvedForReward: wasteReports.approvedForReward,
        createdAt: wasteReports.createdAt,
        citizenName: users.fullName,
        mfyName: mfys.name,
      })
      .from(wasteReports)
      .innerJoin(users, eq(wasteReports.citizenId, users.id))
      .innerJoin(mfys, eq(wasteReports.mfyId, mfys.id))
      .orderBy(desc(wasteReports.createdAt))
      .limit(pageSize)
      .offset(offset);

    const allDisputes = await db
      .select({
        id: disputes.id,
        reportId: disputes.reportId,
        reportCode: wasteReports.publicCode,
        citizenName: users.fullName,
        reason: disputes.reason,
        status: disputes.status,
        resolutionNote: disputes.resolutionNote,
        createdAt: disputes.createdAt,
      })
      .from(disputes)
      .innerJoin(wasteReports, eq(disputes.reportId, wasteReports.id))
      .innerJoin(users, eq(disputes.citizenId, users.id))
      .orderBy(desc(disputes.createdAt))
      .limit(50);

    return res.json({
      reports: rows,
      disputes: allDisputes,
      total: countRow?.total ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Murojaatlarni yuklashda xatolik.' });
  }
});

adminRouter.post('/admin/reports/:id/approve-reward', async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.id);
    const result = await db.transaction(async (tx) => {
      const [report] = await tx
        .select()
        .from(wasteReports)
        .where(eq(wasteReports.id, reportId))
        .for('update');

      if (!report) throw new Error('Murojaat topilmadi.');
      if (report.approvedForReward) {
        return { alreadyApproved: true, citizenId: report.citizenId };
      }

      const rule = await getRewardRule('approved_report');
      await tx
        .update(wasteReports)
        .set({ approvedForReward: true, updatedAt: new Date() })
        .where(eq(wasteReports.id, report.id));

      await tx.insert(reportStatusEvents).values({
        reportId: report.id,
        status: report.status === 'submitted' ? 'reviewing' : report.status,
        actorUserId: req.currentUser!.id,
        note: 'Foydali murojaat administrator tomonidan tasdiqlandi.',
      });

      const award = await awardXpAndCoinsTx(tx, {
        userId: report.citizenId,
        eventKey: `approved_report:${report.id}`,
        sourceType: 'approved_report',
        sourceId: String(report.id),
        xpAmount: rule.xpAmount,
        coinAmount: rule.coinAmount,
        description: `Tasdiqlangan murojaat mukofoti (${report.publicCode})`,
      });

      await createNotificationTx(tx, {
        userId: report.citizenId,
        type: 'report_approved',
        title: 'Murojaatingiz tasdiqlandi!',
        body: `${report.publicCode} foydali murojaat sifatida tasdiqlandi (+${award.xpGranted} XP, +${award.coinsGranted} Eco Ball).`,
        relatedEntityType: 'report',
        relatedEntityId: String(report.id),
      });

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'report_reward_approved',
        targetType: 'report',
        targetId: String(report.id),
        metadata: { xpGranted: award.xpGranted, coinsGranted: award.coinsGranted },
      });

      return { alreadyApproved: false, citizenId: report.citizenId };
    });

    emitAfterCommit({
      keys: ['admin-reports', 'citizen-dashboard', 'citizen-wallet', 'notifications'],
      userIds: [result.citizenId],
      includeAdmins: true,
    });

    return res.json({ ok: true, alreadyApproved: result.alreadyApproved });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Tasdiqlashda xatolik.' });
  }
});

adminRouter.patch('/admin/disputes/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    const resolutionNote = String(req.body?.resolutionNote ?? '').trim();
    if (!['reviewing', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Noto‘g‘ri e’tiroz holati.' });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(disputes)
        .set({ status, resolutionNote, resolvedBy: req.currentUser!.id, updatedAt: new Date() })
        .where(eq(disputes.id, id));

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: `dispute_${status}`,
        targetType: 'dispute',
        targetId: String(id),
        metadata: { resolutionNote },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'E’tirozni yangilashda xatolik.' });
  }
});

// ============================================================
// QUESTS, ECO FACTS, REWARDS, REDEMPTIONS & IDEMPOTENT REFUNDS
// ============================================================

adminRouter.get('/admin/quests', async (_req, res) => {
  const list = await db.select().from(quests).orderBy(quests.id);
  return res.json({
    quests: list.map((q) => ({
      ...q,
      options: q.optionsJson ? JSON.parse(q.optionsJson) : [],
    })),
  });
});

adminRouter.post('/admin/quests', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const templateCode = String(req.body?.templateCode ?? 'eco_bilim');
    const questType = String(req.body?.questType ?? 'quiz');
    const xpReward = Math.max(0, Number(req.body?.xpReward ?? 10));
    const coinReward = Math.max(0, Number(req.body?.coinReward ?? 2));
    const questionText = req.body?.questionText ? String(req.body.questionText).trim() : null;
    const options = Array.isArray(req.body?.options) ? req.body.options.map(String) : null;
    const correctOptionIndex =
      req.body?.correctOptionIndex !== undefined && req.body?.correctOptionIndex !== null
        ? Number(req.body.correctOptionIndex)
        : null;

    if (title.length < 2) return res.status(400).json({ error: 'Sarlavha kiriting.' });

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(quests)
        .values({
          templateCode,
          title,
          description,
          questType,
          xpReward,
          coinReward,
          questionText,
          optionsJson: options ? JSON.stringify(options) : null,
          correctOptionIndex,
          isActive: true,
        })
        .returning();

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'quest_created',
        targetType: 'quest',
        targetId: String(row.id),
        metadata: { title },
      });
      return row;
    });

    return res.status(201).json({ quest: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Topshiriq yaratishda xatolik.' });
  }
});

adminRouter.patch('/admin/quests/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const updates: Record<string, unknown> = {};
    if (typeof req.body?.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (typeof req.body?.title === 'string') updates.title = req.body.title.trim();
    if (req.body?.xpReward !== undefined) updates.xpReward = Number(req.body.xpReward);
    if (req.body?.coinReward !== undefined) updates.coinReward = Number(req.body.coinReward);

    await db.transaction(async (tx) => {
      await tx.update(quests).set(updates).where(eq(quests.id, id));
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'quest_updated',
        targetType: 'quest',
        targetId: String(id),
        metadata: updates,
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Topshiriqni yangilashda xatolik.' });
  }
});

adminRouter.get('/admin/eco-facts', async (_req, res) => {
  const list = await db.select().from(ecoFacts).orderBy(desc(ecoFacts.createdAt));
  return res.json({ ecoFacts: list });
});

adminRouter.post('/admin/eco-facts', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const content = String(req.body?.content ?? '').trim();
    const category = String(req.body?.category ?? 'Ekologiya').trim();
    if (title.length < 3 || content.length < 10) {
      return res.status(400).json({ error: 'Sarlavha va mazmunni to‘liq kiriting.' });
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(ecoFacts).values({ title, content, category, isActive: true }).returning();
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'eco_fact_created',
        targetType: 'eco_fact',
        targetId: String(row.id),
        metadata: { title },
      });
      return row;
    });
    return res.status(201).json({ ecoFact: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Eko-fakt qo‘shishda xatolik.' });
  }
});

adminRouter.delete('/admin/eco-facts/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
      await tx.delete(ecoFacts).where(eq(ecoFacts.id, id));
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'eco_fact_deleted',
        targetType: 'eco_fact',
        targetId: String(id),
      });
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'O‘chirishda xatolik.' });
  }
});

adminRouter.get('/admin/rewards', async (_req, res) => {
  const list = await db.select().from(marketRewards).orderBy(marketRewards.id);
  return res.json({ rewards: list });
});

adminRouter.post('/admin/rewards', async (req: AuthRequest, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const imageUrl = String(req.body?.imageUrl ?? '/src/assets/images/reward_eco_bag_1795168858843.jpg').trim();
    const coinCost = Number(req.body?.coinCost);
    const stockQuantity = Number(req.body?.stockQuantity ?? 0);
    const fulfillmentConditions = String(req.body?.fulfillmentConditions ?? '').trim();

    if (!title || !Number.isInteger(coinCost) || coinCost <= 0 || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return res.status(400).json({ error: 'Sovrin nomi, narxi va qoldig‘ini to‘g‘ri kiriting.' });
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(marketRewards)
        .values({ title, description, imageUrl, coinCost, stockQuantity, fulfillmentConditions, isActive: true })
        .returning();

      if (stockQuantity > 0) {
        await tx.insert(inventoryEvents).values({
          rewardId: row.id,
          delta: stockQuantity,
          reason: 'initial_stock',
          actorUserId: req.currentUser!.id,
        });
      }

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'market_reward_created',
        targetType: 'market_reward',
        targetId: String(row.id),
        metadata: { title, coinCost, stockQuantity },
      });

      return row;
    });

    return res.status(201).json({ reward: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sovrin yaratishda xatolik.' });
  }
});

adminRouter.patch('/admin/rewards/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(marketRewards).where(eq(marketRewards.id, id)).for('update');
      if (!existing) throw new Error('Sovrin topilmadi.');

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body?.isActive === 'boolean') updates.isActive = req.body.isActive;
      if (req.body?.coinCost !== undefined && Number(req.body.coinCost) > 0) {
        updates.coinCost = Number(req.body.coinCost);
      }
      if (req.body?.stockQuantity !== undefined && Number(req.body.stockQuantity) >= 0) {
        const nextStock = Number(req.body.stockQuantity);
        const delta = nextStock - existing.stockQuantity;
        updates.stockQuantity = nextStock;
        if (delta !== 0) {
          await tx.insert(inventoryEvents).values({
            rewardId: id,
            delta,
            reason: 'admin_stock_adjustment',
            actorUserId: req.currentUser!.id,
          });
        }
      }

      await tx.update(marketRewards).set(updates).where(eq(marketRewards.id, id));
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'market_reward_updated',
        targetType: 'market_reward',
        targetId: String(id),
        metadata: updates,
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Yangilashda xatolik.' });
  }
});

adminRouter.get('/admin/redemptions', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(redemptions);

    const rows = await db
      .select({
        id: redemptions.id,
        userId: redemptions.userId,
        citizenName: users.fullName,
        citizenPhone: users.phone,
        rewardId: redemptions.rewardId,
        rewardTitle: marketRewards.title,
        coinCostSnapshot: redemptions.coinCostSnapshot,
        status: redemptions.status,
        fulfillmentNote: redemptions.fulfillmentNote,
        refundedAt: redemptions.refundedAt,
        createdAt: redemptions.createdAt,
      })
      .from(redemptions)
      .innerJoin(users, eq(redemptions.userId, users.id))
      .innerJoin(marketRewards, eq(redemptions.rewardId, marketRewards.id))
      .orderBy(desc(redemptions.createdAt))
      .limit(pageSize)
      .offset(offset);

    return res.json({ redemptions: rows, total: countRow?.total ?? 0, page, pageSize });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Buyurtmalarni yuklashda xatolik.' });
  }
});

adminRouter.post('/admin/redemptions/:id/fulfill', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const note = String(req.body?.fulfillmentNote ?? 'Topshirildi').trim();
    const targetUserId = await db.transaction(async (tx) => {
      const [red] = await tx.select().from(redemptions).where(eq(redemptions.id, id)).for('update');
      if (!red) throw new Error('Buyurtma topilmadi.');
      if (red.status !== 'pending') throw new Error('Faqat kutilayotgan buyurtmani topshirish mumkin.');

      await tx
        .update(redemptions)
        .set({ status: 'fulfilled', fulfillmentNote: note, updatedAt: new Date() })
        .where(eq(redemptions.id, id));

      await createNotificationTx(tx, {
        userId: red.userId,
        type: 'redemption_fulfilled',
        title: 'Sovrin topshirildi',
        body: `Buyurtma #${red.id} muvaffaqiyatli topshirildi.`,
        relatedEntityType: 'redemption',
        relatedEntityId: String(red.id),
      });

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'redemption_fulfilled',
        targetType: 'redemption',
        targetId: String(id),
        metadata: { note },
      });

      return red.userId;
    });

    emitAfterCommit({
      keys: ['admin-redemptions', 'citizen-wallet', 'notifications'],
      userIds: [targetUserId],
      includeAdmins: true,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Xatolik.' });
  }
});

// Idempotent refund: restores coins & stock exactly once
adminRouter.post('/admin/redemptions/:id/refund', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body?.reason ?? 'Administrator tomonidan qaytarildi').trim();

    const outcome = await db.transaction(async (tx) => {
      const [red] = await tx.select().from(redemptions).where(eq(redemptions.id, id)).for('update');
      if (!red) throw new Error('Buyurtma topilmadi.');
      if (red.status === 'refunded' || red.refundedAt !== null) {
        return { alreadyRefunded: true, userId: red.userId };
      }

      // Lock wallet and reward
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, red.userId)).for('update');
      const [reward] = await tx
        .select()
        .from(marketRewards)
        .where(eq(marketRewards.id, red.rewardId))
        .for('update');

      const refundEventKey = `redemption:${red.id}:refund`;
      const inserted = await tx
        .insert(coinLedger)
        .values({
          userId: red.userId,
          eventKey: refundEventKey,
          sourceType: 'redemption_refund',
          sourceId: String(red.id),
          coinAmount: red.coinCostSnapshot,
          description: `Buyurtma #${red.id} qaytarildi: ${reason}`,
        })
        .onConflictDoNothing()
        .returning({ id: coinLedger.id });

      if (inserted.length === 0) {
        return { alreadyRefunded: true, userId: red.userId };
      }

      if (wallet) {
        await tx
          .update(wallets)
          .set({ coinBalance: wallet.coinBalance + red.coinCostSnapshot, updatedAt: new Date() })
          .where(eq(wallets.userId, red.userId));
      }

      if (reward) {
        await tx
          .update(marketRewards)
          .set({ stockQuantity: reward.stockQuantity + 1, updatedAt: new Date() })
          .where(eq(marketRewards.id, reward.id));

        await tx.insert(inventoryEvents).values({
          rewardId: reward.id,
          redemptionId: red.id,
          delta: 1,
          reason: 'redemption_refund_restock',
          actorUserId: req.currentUser!.id,
        });
      }

      await tx
        .update(redemptions)
        .set({ status: 'refunded', refundedAt: new Date(), fulfillmentNote: reason, updatedAt: new Date() })
        .where(eq(redemptions.id, red.id));

      await createNotificationTx(tx, {
        userId: red.userId,
        type: 'redemption_refunded',
        title: 'Eco Ballar qaytarildi',
        body: `Buyurtma #${red.id} bekor qilindi va ${red.coinCostSnapshot} Eco Ball hamyoningizga qaytarildi.`,
        relatedEntityType: 'redemption',
        relatedEntityId: String(red.id),
      });

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'redemption_refunded',
        targetType: 'redemption',
        targetId: String(red.id),
        metadata: { coinsRestored: red.coinCostSnapshot, reason },
      });

      return { alreadyRefunded: false, userId: red.userId };
    });

    emitAfterCommit({
      keys: ['admin-redemptions', 'citizen-wallet', 'citizen-market', 'notifications'],
      userIds: [outcome.userId],
      includeAdmins: true,
    });

    return res.json({ ok: true, alreadyRefunded: outcome.alreadyRefunded });
  } catch (err) {
    console.error('Refund error:', err);
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Qaytarishda xatolik.' });
  }
});

// ============================================================
// SETTINGS (Reward Policies & Volume Estimates) & AUDIT LOGS
// ============================================================

adminRouter.get('/admin/settings', async (_req, res) => {
  const rules = await db.select().from(rewardRules).orderBy(rewardRules.id);
  const volumeEstimates = await getConfiguredVolumeEstimates();
  return res.json({ rewardRules: rules, volumeEstimates });
});

adminRouter.patch('/admin/settings', async (req: AuthRequest, res) => {
  try {
    await db.transaction(async (tx) => {
      if (Array.isArray(req.body?.rewardRules)) {
        for (const r of req.body.rewardRules) {
          if (typeof r.code === 'string' && Number.isInteger(r.xpAmount) && Number.isInteger(r.coinAmount)) {
            await tx
              .update(rewardRules)
              .set({
                xpAmount: Math.max(0, r.xpAmount),
                coinAmount: Math.max(0, r.coinAmount),
                updatedBy: req.currentUser!.id,
                updatedAt: new Date(),
              })
              .where(eq(rewardRules.code, r.code));
          }
        }
      }

      if (req.body?.volumeEstimates && typeof req.body.volumeEstimates === 'object') {
        await tx
          .insert(systemSettings)
          .values({
            key: 'volume_estimates',
            valueJson: JSON.stringify(req.body.volumeEstimates),
            updatedBy: req.currentUser!.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              valueJson: JSON.stringify(req.body.volumeEstimates),
              updatedBy: req.currentUser!.id,
              updatedAt: new Date(),
            },
          });
      }

      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'settings_updated',
        targetType: 'system_settings',
        targetId: 'global',
        metadata: {
          updatedRules: Array.isArray(req.body?.rewardRules),
          updatedVolumes: Boolean(req.body?.volumeEstimates),
        },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Sozlamalarni saqlashda xatolik.' });
  }
});

adminRouter.get('/admin/audit', async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLogs);

    const rows = await db
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorName: users.fullName,
        actorRole: auditLogs.actorRole,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadataJson: auditLogs.metadataJson,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    return res.json({ logs: rows, total: countRow?.total ?? 0, page, pageSize });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Audit jurnalini yuklashda xatolik.' });
  }
});

// ============================================================
// YASHNAR AI (Controlled Server-Side Analytics Functions ONLY — Zero Arbitrary SQL)
// ============================================================

async function collectControlledOperationalSnapshot() {
  const now = new Date();
  const todayStr = getTashkentDateString(now);
  const sevenDaysAgo = new Date(`${addDaysToDateString(todayStr, -6)}T00:00:00+05:00`);
  const delayedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. MFY workloads
  const mfyRows = await db
    .select({
      id: mfys.id,
      name: mfys.name,
      districtName: districts.name,
      thresholdLiters: mfys.workloadThresholdLiters,
    })
    .from(mfys)
    .innerJoin(districts, eq(mfys.districtId, districts.id))
    .where(ne(mfys.status, 'merged'));

  const pendingByMfy = await db
    .select({
      mfyId: wasteReports.mfyId,
      pendingCount: sql<number>`count(*)::int`,
      estimatedLiters: sql<number>`coalesce(sum(${wasteReports.estimatedLiters}), 0)::int`,
    })
    .from(wasteReports)
    .where(inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived']))
    .groupBy(wasteReports.mfyId);

  const pendingMap = new Map(pendingByMfy.map((p) => [p.mfyId, p]));
  const mfyWorkloads = mfyRows
    .map((m) => {
      const p = pendingMap.get(m.id);
      const wl = calculateWorkload(p?.estimatedLiters ?? 0, m.thresholdLiters);
      return {
        mfyName: m.name,
        districtName: m.districtName,
        pendingCount: p?.pendingCount ?? 0,
        estimatedPendingLiters: wl.estimatedPendingLiters,
        thresholdLiters: wl.thresholdLiters,
        workloadPercent: wl.uncappedPercent,
        recommendedCollection: wl.recommendedCollection,
      };
    })
    .sort((a, b) => b.workloadPercent - a.workloadPercent);

  // 2. Last 7 days collection totals
  const [last7Days] = await db
    .select({
      totalReports: sql<number>`count(*)::int`,
      completedCount: sql<number>`count(*) filter (where ${wasteReports.status} = 'completed')::int`,
      verifiedCollectedLiters: sql<number>`coalesce(sum(${wasteReports.actualLiters}) filter (where ${wasteReports.status} = 'completed'), 0)::float`,
    })
    .from(wasteReports)
    .where(gte(wasteReports.createdAt, sevenDaysAgo));

  // 3. Delayed requests (>24h pending)
  const delayedReports = await db
    .select({
      publicCode: wasteReports.publicCode,
      mfyName: mfys.name,
      category: wasteReports.category,
      status: wasteReports.status,
      createdAt: wasteReports.createdAt,
    })
    .from(wasteReports)
    .innerJoin(mfys, eq(wasteReports.mfyId, mfys.id))
    .where(
      and(
        inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned']),
        lte(wasteReports.createdAt, delayedCutoff)
      )
    )
    .orderBy(wasteReports.createdAt)
    .limit(15);

  // 4. Active trips
  const activeTrips = await db
    .select({
      tripId: driverTrips.id,
      mfyName: mfys.name,
      startedAt: driverTrips.startedAt,
    })
    .from(driverTrips)
    .innerJoin(mfys, eq(driverTrips.mfyId, mfys.id))
    .where(eq(driverTrips.status, 'active'));

  return {
    timeRange: `${addDaysToDateString(todayStr, -6)} — ${todayStr} (Asia/Tashkent)`,
    dataFreshness: now.toISOString(),
    mfyWorkloads: mfyWorkloads.slice(0, 15),
    last7Days: {
      totalReports: last7Days?.totalReports ?? 0,
      completedCount: last7Days?.completedCount ?? 0,
      verifiedCollectedLiters: Math.round((last7Days?.verifiedCollectedLiters ?? 0) * 10) / 10,
    },
    delayedReportsCount: delayedReports.length,
    delayedReports,
    activeTripsCount: activeTrips.length,
    activeTrips,
  };
}

adminRouter.post('/admin/ai', async (req: AuthRequest, res) => {
  try {
    const parsed = aiQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message });
    }

    const snapshot = await collectControlledOperationalSnapshot();
    const systemPrompt = `Siz YASHNAR tizimining operatsion tahlilchisi (YASHNAR AI) siz.
FAQAT quyida taqdim etilgan haqiqiy ma'lumotlar bazasi (PostgreSQL) ko'rsatkichlaridan foydalaning.
HECH QACHON raqamlarni to'qib chiqarmang va yetarli dalil bo'lmasa haydovchilarni reytinglamang.
Javobni O'zbek (Lotin) tilida, aniq va quyidagi 5 bo'lim bilan qaytaring:
1. Vaqt oralig'i
2. Ma'lumotlar yangiligi
3. Tasdiqlovchi ko'rsatkichlar
4. Yetishmayotgan ma'lumotlar
5. Tavsiya etilgan harakat`;

    const userPrompt = `Administrator savoli: ${parsed.data.question}\n\nHaqiqiy bazadan olingan operatsion ko'rsatkichlar (JSON):\n${JSON.stringify(snapshot, null, 2)}`;

    let answerText: string | null = null;
    let providerUsed: string | null = null;

    // Prefer OpenAI if OPENAI_API_KEY is configured, else use server-side Gemini API if GEMINI_API_KEY is configured
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });
      if (!openaiRes.ok) {
        const errBody = await openaiRes.text();
        throw new Error(`OpenAI API xatoligi (${openaiRes.status}): ${errBody.slice(0, 200)}`);
      }
      const data = (await openaiRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      answerText = data.choices?.[0]?.message?.content ?? null;
      providerUsed = 'OpenAI';
    } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY.trim(),
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
      let lastAiErr: unknown = null;
      for (const modelName of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: userPrompt,
              config: {
                systemInstruction: systemPrompt,
              },
            });
            answerText = response.text ?? null;
            if (answerText) {
              providerUsed = `Gemini (${modelName})`;
              break;
            }
          } catch (modelErr) {
            lastAiErr = modelErr;
            const errStr = String(modelErr instanceof Error ? modelErr.message : modelErr);
            const isTransient = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('429');
            console.warn(`Gemini model ${modelName} attempt ${attempt + 1} failed:`, errStr.slice(0, 200));
            if (isTransient && attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 900));
              continue;
            }
            break;
          }
        }
        if (answerText) break;
      }
      if (!answerText && lastAiErr) {
        throw lastAiErr;
      }
    } else {
      return res.status(503).json({
        error:
          'AI tahlil xizmati uchun server API kaliti (OPENAI_API_KEY yoki GEMINI_API_KEY) sozlanmagan.',
      });
    }

    if (!answerText) {
      return res.status(502).json({ error: 'AI provayderidan bo‘sh javob qaytdi.' });
    }

    await db.transaction(async (tx) => {
      await recordAuditLogTx(tx, {
        actorUserId: req.currentUser!.id,
        actorRole: 'admin',
        action: 'admin_ai_query',
        targetType: 'ai_analytics',
        targetId: providerUsed ?? 'ai',
        metadata: { questionLength: parsed.data.question.length },
      });
    });

    return res.json({
      answer: answerText,
      meta: {
        timeRange: snapshot.timeRange,
        dataFreshness: snapshot.dataFreshness,
        provider: providerUsed,
        mfyCount: snapshot.mfyWorkloads.length,
        delayedCount: snapshot.delayedReportsCount,
      },
    });
  } catch (err) {
    console.error('Admin AI error:', err);
    const rawMsg = err instanceof Error ? err.message : '';
    let friendlyError = 'YASHNAR AI tahlilida xatolik yuz berdi. Birozdan so‘ng qaytadan urinib ko‘ring.';
    let statusCode = 500;
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
      statusCode = 503;
      friendlyError =
        'AI serveri hozirda yuqori yuklamada. Iltimos, 5–10 soniyadan so‘ng qaytadan yuboring.';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      statusCode = 429;
      friendlyError =
        'AI API so‘rov limiti vaqtincha to‘ldi. Biroz kutib qaytadan urinib ko‘ring yoki Settings > Secrets bo‘limida API kalitni tekshiring.';
    } else if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
      statusCode = 403;
      friendlyError =
        'GEMINI_API_KEY kaliti yaroqsiz yoki ruxsat yetarli emas. Settings > Secrets bo‘limida kalitni tekshiring.';
    }
    return res.status(statusCode).json({ error: friendlyError });
  }
});
