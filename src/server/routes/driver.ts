import { Router } from 'express';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  drivers,
  driverAssignments,
  driverTrips,
  driverLocations,
  mfys,
  districts,
  wasteReports,
  reportStatusEvents,
  qrCredentials,
  qrScanEvents,
  users,
} from '../../db/schema.ts';
import {
  calculateWorkload,
  confirmPickupSchema,
  getTashkentDateString,
  isLocationStale,
  shouldSendGpsUpdate,
} from '../../lib/domain.ts';
import { sha256Hex } from '../crypto.ts';
import { requireRole, type AuthRequest } from '../auth.ts';
import {
  awardXpAndCoinsTx,
  createNotificationTx,
  emitAfterCommit,
  getRewardRule,
  purgeAbandonedLocations,
  PRIVATE_REPORTS_DIR,
} from '../services.ts';
import path from 'node:path';
import fs from 'node:fs';

export const driverRouter = Router();

driverRouter.use('/driver', requireRole('driver'));

/** Normalizes an Uzbek vehicle plate ("01 A 123 BC" / "01 123 ABC"). Returns null if invalid. */
function normalizePlate(raw: unknown): string | null {
  const v = String(raw ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (v.length < 5 || v.length > 16 || !/^[0-9A-Z ]+$/.test(v) || !/[0-9]/.test(v)) return null;
  return v;
}
const PLATE_ERROR = 'Avtomobil raqamini to‘g‘ri kiriting (masalan: 50 A 123 BC).';

driverRouter.patch('/driver/vehicle', async (req: AuthRequest, res) => {
  const plate = normalizePlate(req.body?.vehiclePlate);
  if (!plate) return res.status(400).json({ error: PLATE_ERROR });
  try {
    await db.update(drivers).set({ vehiclePlate: plate }).where(eq(drivers.id, req.currentUser!.driverId!));
    emitAfterCommit({ keys: ['admin-drivers', 'driver-dashboard'], includeAdmins: true });
    return res.json({ vehiclePlate: plate });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Avtomobil raqamini saqlashda xatolik.' });
  }
});

async function getAssignedMfyIds(driverId: number): Promise<number[]> {
  const rows = await db
    .select({ mfyId: driverAssignments.mfyId })
    .from(driverAssignments)
    .where(and(eq(driverAssignments.driverId, driverId), eq(driverAssignments.isActive, true)));
  return rows.map((r) => r.mfyId);
}

// ============================================================
// DRIVER DASHBOARD & ASSIGNED MFYs
// ============================================================

driverRouter.get('/driver/dashboard', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const assignedMfyIds = await getAssignedMfyIds(driverId);

    const todayStr = getTashkentDateString(new Date());
    const todayStart = new Date(`${todayStr}T00:00:00+05:00`);

    const [todayPickups] = await db
      .select({
        count: sql<number>`count(*)::int`,
        liters: sql<number>`coalesce(sum(${wasteReports.actualLiters}), 0)::float`,
      })
      .from(wasteReports)
      .where(
        and(
          eq(wasteReports.assignedDriverId, driverId),
          eq(wasteReports.status, 'completed'),
          gte(wasteReports.updatedAt, todayStart)
        )
      );

    const [totalVerified] = await db
      .select({
        liters: sql<number>`coalesce(sum(${wasteReports.actualLiters}), 0)::float`,
      })
      .from(wasteReports)
      .where(and(eq(wasteReports.assignedDriverId, driverId), eq(wasteReports.status, 'completed')));

    let pendingCount = 0;
    if (assignedMfyIds.length > 0) {
      const [pRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(wasteReports)
        .where(
          and(
            inArray(wasteReports.mfyId, assignedMfyIds),
            inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived'])
          )
        );
      pendingCount = pRow?.count ?? 0;
    }

    const [activeTrip] = await db
      .select({
        id: driverTrips.id,
        mfyId: driverTrips.mfyId,
        mfyName: mfys.name,
        startedAt: driverTrips.startedAt,
        totalCollectedLiters: driverTrips.totalCollectedLiters,
      })
      .from(driverTrips)
      .innerJoin(mfys, eq(driverTrips.mfyId, mfys.id))
      .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
      .limit(1);

    return res.json({
      stats: {
        todayPickups: todayPickups?.count ?? 0,
        pendingRequests: pendingCount,
        hasActiveTrip: Boolean(activeTrip),
        verifiedCollectedLiters: Math.round((totalVerified?.liters ?? 0) * 10) / 10,
        assignedMfysCount: assignedMfyIds.length,
      },
      activeTrip: activeTrip ?? null,
    });
  } catch (err) {
    console.error('Driver dashboard error:', err);
    return res.status(500).json({ error: 'Haydovchi panelini yuklashda xatolik.' });
  }
});

driverRouter.get('/driver/mfys', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const assigned = await db
      .select({
        mfyId: mfys.id,
        mfyName: mfys.name,
        districtName: districts.name,
        thresholdLiters: mfys.workloadThresholdLiters,
        status: mfys.status,
      })
      .from(driverAssignments)
      .innerJoin(mfys, eq(driverAssignments.mfyId, mfys.id))
      .innerJoin(districts, eq(mfys.districtId, districts.id))
      .where(and(eq(driverAssignments.driverId, driverId), eq(driverAssignments.isActive, true)))
      .orderBy(mfys.name);

    const [activeTrip] = await db
      .select()
      .from(driverTrips)
      .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
      .limit(1);

    const items = [];
    for (const row of assigned) {
      const [agg] = await db
        .select({
          pendingCount: sql<number>`count(*)::int`,
          estimatedLiters: sql<number>`coalesce(sum(${wasteReports.estimatedLiters}), 0)::int`,
        })
        .from(wasteReports)
        .where(
          and(
            eq(wasteReports.mfyId, row.mfyId),
            inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived'])
          )
        );

      const workload = calculateWorkload(agg?.estimatedLiters ?? 0, row.thresholdLiters);
      items.push({
        mfyId: row.mfyId,
        mfyName: row.mfyName,
        districtName: row.districtName,
        pendingCount: agg?.pendingCount ?? 0,
        ...workload,
        isActiveTripMfy: activeTrip?.mfyId === row.mfyId,
      });
    }

    return res.json({ mfys: items, activeTrip: activeTrip ?? null });
  } catch (err) {
    console.error('Driver MFYs error:', err);
    return res.status(500).json({ error: 'Biriktirilgan MFYlarni yuklashda xatolik.' });
  }
});

// ============================================================
// TRIPS (Prevent >1 active trip per driver, Notify MFY Citizens)
// ============================================================

driverRouter.get('/driver/trips', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const trips = await db
      .select({
        id: driverTrips.id,
        mfyId: driverTrips.mfyId,
        mfyName: mfys.name,
        status: driverTrips.status,
        startedAt: driverTrips.startedAt,
        endedAt: driverTrips.endedAt,
        totalCollectedLiters: driverTrips.totalCollectedLiters,
      })
      .from(driverTrips)
      .innerJoin(mfys, eq(driverTrips.mfyId, mfys.id))
      .where(eq(driverTrips.driverId, driverId))
      .orderBy(desc(driverTrips.startedAt))
      .limit(50);

    return res.json({ trips });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Reyslar ro‘yxatini yuklashda xatolik.' });
  }
});

driverRouter.post('/driver/trips/start', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const mfyId = Number(req.body?.mfyId);
    if (!Number.isInteger(mfyId) || mfyId <= 0) {
      return res.status(400).json({ error: 'MFY tanlanmagan.' });
    }

    // Verify driver is assigned to this MFY
    const [assignment] = await db
      .select()
      .from(driverAssignments)
      .where(
        and(
          eq(driverAssignments.driverId, driverId),
          eq(driverAssignments.mfyId, mfyId),
          eq(driverAssignments.isActive, true)
        )
      )
      .limit(1);

    if (!assignment) {
      return res.status(403).json({ error: 'Siz ushbu MFYga biriktirilmagansiz.' });
    }

    const result = await db.transaction(async (tx) => {
      // Lock driver row to prevent race conditions creating >1 active trip
      await tx.select().from(drivers).where(eq(drivers.id, driverId)).for('update');

      const [existingActive] = await tx
        .select()
        .from(driverTrips)
        .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
        .limit(1);

      if (existingActive) {
        throw new Error('ACTIVE_EXISTS:Sizda allaqachon faol reys mavjud. Avval uni yakunlang.');
      }

      const [mfyRow] = await tx.select().from(mfys).where(eq(mfys.id, mfyId)).limit(1);

      const [trip] = await tx
        .insert(driverTrips)
        .values({
          driverId,
          mfyId,
          status: 'active',
        })
        .returning();

      // Update eligible pending reports in this MFY to en_route
      const pendingReports = await tx
        .select()
        .from(wasteReports)
        .where(
          and(
            eq(wasteReports.mfyId, mfyId),
            inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned']),
            sql`waste_reports.moderation_status = 'approved'`
          )
        );

      const notifiedCitizenIds = new Set<number>();
      for (const rep of pendingReports) {
        await tx
          .update(wasteReports)
          .set({
            status: 'en_route',
            assignedDriverId: driverId,
            tripId: trip.id,
            updatedAt: new Date(),
          })
          .where(eq(wasteReports.id, rep.id));

        await tx.insert(reportStatusEvents).values({
          reportId: rep.id,
          status: 'en_route',
          actorUserId: req.currentUser!.id,
          note: `Haydovchi ${req.currentUser!.fullName} ${mfyRow?.name ?? 'MFY'} bo‘yicha yo‘lga chiqdi.`,
        });

        notifiedCitizenIds.add(rep.citizenId);
      }

      // Also notify citizens registered in this MFY who have pending pickups
      const mfyCitizens = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.mfyId, mfyId), eq(users.role, 'citizen'), eq(users.accountStatus, 'active')));
      for (const c of mfyCitizens) {
        notifiedCitizenIds.add(c.id);
      }

      for (const citizenId of notifiedCitizenIds) {
        await createNotificationTx(tx, {
          userId: citizenId,
          type: 'driver_trip_started',
          title: 'Haydovchi yo‘lga chiqdi',
          body: `${mfyRow?.name ?? 'Mahallangiz'} bo‘yicha chiqindi yig‘ish reysi boshlandi. QR kodingizni tayyorlab qo‘ying.`,
          relatedEntityType: 'trip',
          relatedEntityId: String(trip.id),
        });
      }

      return { trip, notifiedCitizenIds: Array.from(notifiedCitizenIds) };
    });

    emitAfterCommit({
      keys: ['driver-dashboard', 'driver-mfys', 'driver-trips', 'citizen-dashboard', 'citizen-reports', 'citizen-map', 'notifications'],
      userIds: [req.currentUser!.id, ...result.notifiedCitizenIds],
      mfyId,
      includeAdmins: true,
    });

    return res.status(201).json({ trip: result.trip });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('ACTIVE_EXISTS:')) {
      return res.status(409).json({ error: msg.slice('ACTIVE_EXISTS:'.length) });
    }
    console.error('Start trip error:', err);
    return res.status(500).json({ error: 'Reysni boshlashda xatolik yuz berdi.' });
  }
});

driverRouter.post('/driver/trips/:id/end', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const tripId = Number(req.params.id);

    const [trip] = await db
      .select()
      .from(driverTrips)
      .where(and(eq(driverTrips.id, tripId), eq(driverTrips.driverId, driverId)))
      .limit(1);

    if (!trip) {
      return res.status(404).json({ error: 'Reys topilmadi.' });
    }
    if (trip.status !== 'active') {
      return res.status(400).json({ error: 'Reys allaqachon yakunlangan.' });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(driverTrips)
        .set({ status: 'completed', endedAt: new Date() })
        .where(eq(driverTrips.id, trip.id));

      // Delete current trip location immediately at trip end
      await tx.delete(driverLocations).where(eq(driverLocations.tripId, trip.id));
    });

    emitAfterCommit({
      keys: ['driver-dashboard', 'driver-mfys', 'driver-trips', 'citizen-map', 'admin-map'],
      userIds: [req.currentUser!.id],
      mfyId: trip.mfyId,
      includeAdmins: true,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('End trip error:', err);
    return res.status(500).json({ error: 'Reysni yakunlashda xatolik.' });
  }
});

// ============================================================
// GPS LOCATION SHARING (15s / 20m / 60s policy)
// ============================================================

driverRouter.post('/driver/location', async (req: AuthRequest, res) => {
  try {
    await purgeAbandonedLocations();
    const driverId = req.currentUser!.driverId!;
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const accuracyMeters = Number(req.body?.accuracyMeters ?? 25);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({ error: 'GPS koordinatalari noto‘g‘ri.' });
    }

    const [activeTrip] = await db
      .select()
      .from(driverTrips)
      .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
      .limit(1);

    if (!activeTrip) {
      return res.status(400).json({ error: 'GPS ulashish uchun avval faol reys boshlang.' });
    }

    const [lastLoc] = await db
      .select()
      .from(driverLocations)
      .where(eq(driverLocations.tripId, activeTrip.id))
      .limit(1);

    const nowMs = Date.now();
    const decision = shouldSendGpsUpdate(
      lastLoc
        ? { lat: lastLoc.latitude, lng: lastLoc.longitude, timestampMs: lastLoc.receivedAt.getTime() }
        : null,
      { lat: latitude, lng: longitude, timestampMs: nowMs }
    );

    if (!decision.allow) {
      return res.status(200).json({
        accepted: false,
        reason: decision.reason,
        receivedAt: lastLoc?.receivedAt.toISOString(),
      });
    }

    const now = new Date(nowMs);
    await db
      .insert(driverLocations)
      .values({
        tripId: activeTrip.id,
        driverId,
        mfyId: activeTrip.mfyId,
        latitude,
        longitude,
        accuracyMeters: Number.isFinite(accuracyMeters) && accuracyMeters > 0 ? accuracyMeters : 25,
        recordedAt: req.body?.recordedAt ? new Date(req.body.recordedAt) : now,
        receivedAt: now,
      })
      .onConflictDoUpdate({
        target: driverLocations.tripId,
        set: {
          latitude,
          longitude,
          accuracyMeters: Number.isFinite(accuracyMeters) && accuracyMeters > 0 ? accuracyMeters : 25,
          recordedAt: req.body?.recordedAt ? new Date(req.body.recordedAt) : now,
          receivedAt: now,
        },
      });

    emitAfterCommit({
      keys: ['citizen-map', 'driver-map', 'admin-map'],
      mfyId: activeTrip.mfyId,
      includeAdmins: true,
    });

    return res.json({
      accepted: true,
      reason: decision.reason,
      receivedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('Driver location error:', err);
    return res.status(500).json({ error: 'Joylashuvni saqlashda xatolik.' });
  }
});

const ACTIVE_REPORT_STATUSES = ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived'];

/** Reports (murojaatlar) from the MFYs assigned to this driver. ?scope=active (default) | all */
driverRouter.get('/driver/reports', async (req: AuthRequest, res) => {
  try {
    const mfyIds = await getAssignedMfyIds(req.currentUser!.driverId!);
    if (!mfyIds.length) return res.json({ reports: [] });
    const all = req.query.scope === 'all';
    const rows = await db
      .select({
        id: wasteReports.id,
        publicCode: wasteReports.publicCode,
        category: wasteReports.category,
        estimatedRange: wasteReports.estimatedRange,
        estimatedLiters: wasteReports.estimatedLiters,
        actualLiters: wasteReports.actualLiters,
        description: wasteReports.description,
        address: wasteReports.address,
        latitude: wasteReports.latitude,
        longitude: wasteReports.longitude,
        status: wasteReports.status,
        hasPhoto: sql<boolean>`${wasteReports.photoStorageKey} IS NOT NULL`,
        createdAt: wasteReports.createdAt,
        mfyName: mfys.name,
        citizenName: users.fullName,
        citizenPhone: users.phone,
      })
      .from(wasteReports)
      .innerJoin(mfys, eq(wasteReports.mfyId, mfys.id))
      .innerJoin(users, eq(wasteReports.citizenId, users.id))
      .where(
        all
          ? and(inArray(wasteReports.mfyId, mfyIds), sql`waste_reports.moderation_status = 'approved'`)
          : and(
              inArray(wasteReports.mfyId, mfyIds),
              inArray(wasteReports.status, ACTIVE_REPORT_STATUSES),
              sql`waste_reports.moderation_status = 'approved'`
            )
      )
      .orderBy(desc(wasteReports.createdAt))
      .limit(200);
    return res.json({ reports: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Murojaatlarni yuklashda xatolik.' });
  }
});

/** Report photo, only for reports in the driver's assigned MFYs. */
driverRouter.get('/driver/reports/:id/photo', async (req: AuthRequest, res) => {
  try {
    const mfyIds = await getAssignedMfyIds(req.currentUser!.driverId!);
    const [r] = await db
      .select({ key: wasteReports.photoStorageKey, mfyId: wasteReports.mfyId })
      .from(wasteReports)
      .where(eq(wasteReports.id, Number(req.params.id)))
      .limit(1);
    if (!r || !r.key || !mfyIds.includes(r.mfyId)) return res.status(404).json({ error: 'Rasm topilmadi.' });
    const file = path.join(PRIVATE_REPORTS_DIR, path.basename(r.key));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Rasm topilmadi.' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(file);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Rasmni yuklashda xatolik.' });
  }
});

driverRouter.get('/driver/map', async (req: AuthRequest, res) => {
  try {
    await purgeAbandonedLocations();
    const driverId = req.currentUser!.driverId!;
    const assignedMfyIds = await getAssignedMfyIds(driverId);

    const [activeTrip] = await db
      .select({
        id: driverTrips.id,
        mfyId: driverTrips.mfyId,
        mfyName: mfys.name,
        startedAt: driverTrips.startedAt,
      })
      .from(driverTrips)
      .innerJoin(mfys, eq(driverTrips.mfyId, mfys.id))
      .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
      .limit(1);

    let currentLocation = null;
    if (activeTrip) {
      const [loc] = await db
        .select()
        .from(driverLocations)
        .where(eq(driverLocations.tripId, activeTrip.id))
        .limit(1);
      if (loc) {
        currentLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracyMeters: loc.accuracyMeters,
          receivedAt: loc.receivedAt.toISOString(),
          isStale: isLocationStale(loc.receivedAt.getTime()),
        };
      }
    }

    const pickups =
      assignedMfyIds.length > 0
        ? await db
            .select({
              id: wasteReports.id,
              publicCode: wasteReports.publicCode,
              mfyId: wasteReports.mfyId,
              mfyName: mfys.name,
              category: wasteReports.category,
              estimatedRange: wasteReports.estimatedRange,
              estimatedLiters: wasteReports.estimatedLiters,
              status: wasteReports.status,
              address: wasteReports.address,
              latitude: wasteReports.latitude,
              longitude: wasteReports.longitude,
              citizenName: users.fullName,
            })
            .from(wasteReports)
            .innerJoin(mfys, eq(wasteReports.mfyId, mfys.id))
            .innerJoin(users, eq(wasteReports.citizenId, users.id))
            .where(
              and(
                inArray(wasteReports.mfyId, assignedMfyIds),
                inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived']),
                sql`waste_reports.moderation_status = 'approved'`
              )
            )
            .orderBy(desc(wasteReports.createdAt))
        : [];

    return res.json({
      activeTrip: activeTrip ?? null,
      currentLocation,
      pickups,
    });
  } catch (err) {
    console.error('Driver map error:', err);
    return res.status(500).json({ error: 'Haydovchi xaritasini yuklashda xatolik.' });
  }
});

// ============================================================
// QR SCAN & ATOMIC COLLECTION CONFIRMATION
// ============================================================

driverRouter.post('/driver/scan/verify', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const qrToken = typeof req.body?.qrToken === 'string' ? req.body.qrToken.trim() : '';
    if (!qrToken || qrToken.length < 16) {
      return res.status(400).json({ error: 'QR kod yaroqsiz.' });
    }

    const [activeTrip] = await db
      .select()
      .from(driverTrips)
      .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
      .limit(1);

    if (!activeTrip) {
      return res.status(400).json({ error: 'QR skanerlash uchun avval MFY bo‘yicha faol reys boshlang.' });
    }

    const digest = sha256Hex(qrToken);
    const [cred] = await db
      .select()
      .from(qrCredentials)
      .where(eq(qrCredentials.tokenDigest, digest))
      .limit(1);

    if (!cred) {
      return res.status(404).json({ error: 'QR kod topilmadi yoki yaroqsiz.' });
    }
    if (cred.revokedAt) {
      return res.status(400).json({ error: 'Ushbu QR kod bekor qilingan. Fuqaroga yangilashni so‘rang.' });
    }
    if (cred.expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'QR kodning amal qilish muddati tugagan. Yangi QR kod ko‘rsating.' });
    }

    const [citizen] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        mfyId: users.mfyId,
      })
      .from(users)
      .where(eq(users.id, cred.userId))
      .limit(1);

    if (!citizen) {
      return res.status(404).json({ error: 'Fuqaro topilmadi.' });
    }

    // Eligible pickups for this citizen in the active trip's MFY
    const eligiblePickups = await db
      .select({
        id: wasteReports.id,
        publicCode: wasteReports.publicCode,
        category: wasteReports.category,
        estimatedRange: wasteReports.estimatedRange,
        estimatedLiters: wasteReports.estimatedLiters,
        address: wasteReports.address,
        status: wasteReports.status,
        createdAt: wasteReports.createdAt,
      })
      .from(wasteReports)
      .where(
        and(
          eq(wasteReports.citizenId, citizen.id),
          eq(wasteReports.mfyId, activeTrip.mfyId),
          inArray(wasteReports.status, ['submitted', 'reviewing', 'assigned', 'en_route', 'arrived'])
        )
      )
      .orderBy(desc(wasteReports.createdAt));

    // Record scan event with status 'scanned' — NEVER award XP/coins on scan alone!
    const scanIdemp = `scan:${cred.id}:trip:${activeTrip.id}:ts:${Math.floor(Date.now() / 5000)}`;
    await db
      .insert(qrScanEvents)
      .values({
        credentialId: cred.id,
        driverId,
        tripId: activeTrip.id,
        citizenId: citizen.id,
        reportId: eligiblePickups[0]?.id ?? null,
        idempotencyKey: scanIdemp,
        status: 'scanned',
      })
      .onConflictDoNothing();

    return res.json({
      citizen: {
        id: citizen.id,
        displayName: citizen.fullName,
      },
      tripId: activeTrip.id,
      eligiblePickups,
    });
  } catch (err) {
    console.error('QR verify error:', err);
    return res.status(500).json({ error: 'QR kodni tekshirishda xatolik yuz berdi.' });
  }
});

driverRouter.post('/driver/scan/confirm', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const parsed = confirmPickupSchema.safeParse({
      qrToken: req.body?.qrToken,
      reportId: Number(req.body?.reportId),
      actualLiters: Number(req.body?.actualLiters),
      idempotencyKey: req.body?.idempotencyKey,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Tasdiqlash ma’lumotlari noto‘g‘ri.' });
    }

    const { qrToken, reportId, actualLiters, idempotencyKey } = parsed.data;

    const outcome = await db.transaction(async (tx) => {
      // Idempotency check on confirm event
      const [existingConfirm] = await tx
        .select()
        .from(qrScanEvents)
        .where(eq(qrScanEvents.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existingConfirm && existingConfirm.status === 'confirmed') {
        return { duplicate: true, xpGranted: 0, coinsGranted: 0, citizenId: existingConfirm.citizenId, mfyId: 0 };
      }

      const [activeTrip] = await tx
        .select()
        .from(driverTrips)
        .where(and(eq(driverTrips.driverId, driverId), eq(driverTrips.status, 'active')))
        .limit(1);

      if (!activeTrip) {
        throw new Error('BAD_REQUEST:Faol reys topilmadi.');
      }

      const digest = sha256Hex(qrToken);
      const [cred] = await tx
        .select()
        .from(qrCredentials)
        .where(and(eq(qrCredentials.tokenDigest, digest), isNull(qrCredentials.revokedAt)))
        .limit(1);

      if (!cred || cred.expiresAt.getTime() <= Date.now()) {
        throw new Error('BAD_REQUEST:QR kod yaroqsiz yoki muddati tugagan.');
      }

      // Lock report row FOR UPDATE to prevent double-completion across different idempotency keys
      const lockedReports = await tx
        .select()
        .from(wasteReports)
        .where(eq(wasteReports.id, reportId))
        .for('update');
      const report = lockedReports[0];

      if (!report || report.citizenId !== cred.userId) {
        throw new Error('NOT_FOUND:Ushbu fuqaroga tegishli murojaat topilmadi.');
      }
      if (report.mfyId !== activeTrip.mfyId) {
        throw new Error('FORBIDDEN:Ushbu murojaat faol reys MFYsiga tegishli emas.');
      }
      if (report.status === 'completed') {
        return { duplicate: true, xpGranted: 0, coinsGranted: 0, citizenId: report.citizenId, mfyId: report.mfyId };
      }
      if (report.status === 'cancelled') {
        throw new Error('BAD_REQUEST:Bekor qilingan murojaatni yakunlab bo‘lmaydi.');
      }

      // 1. Mark report completed with verified actualLiters
      await tx
        .update(wasteReports)
        .set({
          status: 'completed',
          actualLiters,
          assignedDriverId: driverId,
          tripId: activeTrip.id,
          updatedAt: new Date(),
        })
        .where(eq(wasteReports.id, report.id));

      // 2. Persist status event
      await tx.insert(reportStatusEvents).values({
        reportId: report.id,
        status: 'completed',
        actorUserId: req.currentUser!.id,
        note: `QR orqali tasdiqlandi. Haqiqiy yig‘ilgan hajm: ${actualLiters} L.`,
      });

      // 3. Persist confirmed scan record
      await tx.insert(qrScanEvents).values({
        credentialId: cred.id,
        driverId,
        tripId: activeTrip.id,
        citizenId: report.citizenId,
        reportId: report.id,
        idempotencyKey,
        actualLiters,
        status: 'confirmed',
      });

      // 4. Update trip total collected liters
      await tx
        .update(driverTrips)
        .set({
          totalCollectedLiters: sql`${driverTrips.totalCollectedLiters} + ${actualLiters}`,
        })
        .where(eq(driverTrips.id, activeTrip.id));

      // 5. Atomically award XP & Eco Coins with unique event key per pickup
      const rule = await getRewardRule('verified_qr_pickup');
      const rewardEventKey = `pickup_verified:${report.id}`;
      const award = await awardXpAndCoinsTx(tx, {
        userId: report.citizenId,
        eventKey: rewardEventKey,
        sourceType: 'verified_qr_pickup',
        sourceId: String(report.id),
        xpAmount: rule.xpAmount,
        coinAmount: rule.coinAmount,
        description: `Tasdiqlangan yig‘im (${report.publicCode}, ${actualLiters} L)`,
      });

      // 6. Persist citizen notification
      await createNotificationTx(tx, {
        userId: report.citizenId,
        type: 'pickup_completed',
        title: 'Chiqindi yig‘imi tasdiqlandi!',
        body: `${report.publicCode} (${actualLiters} L) yakunlandi. +${award.xpGranted} XP va +${award.coinsGranted} Eco Ball berildi.`,
        relatedEntityType: 'report',
        relatedEntityId: String(report.id),
      });

      return {
        duplicate: false,
        xpGranted: award.xpGranted,
        coinsGranted: award.coinsGranted,
        citizenId: report.citizenId,
        mfyId: report.mfyId,
      };
    });

    emitAfterCommit({
      keys: [
        'driver-dashboard',
        'driver-mfys',
        'driver-history',
        'citizen-dashboard',
        'citizen-reports',
        'citizen-wallet',
        'citizen-leaderboard',
        'admin-analytics',
        'notifications',
      ],
      userIds: [req.currentUser!.id, outcome.citizenId],
      includeAdmins: true,
    });

    return res.json({
      ok: true,
      duplicate: outcome.duplicate,
      xpGranted: outcome.xpGranted,
      coinsGranted: outcome.coinsGranted,
      message: outcome.duplicate
        ? 'Ushbu yig‘im allaqachon tasdiqlangan (takroriy mukofot berilmadi).'
        : `Yig‘im muvaffaqiyatli tasdiqlandi! Fuqaroga +${outcome.xpGranted} XP va +${outcome.coinsGranted} Eco Ball berildi.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.startsWith('BAD_REQUEST:')) return res.status(400).json({ error: msg.slice('BAD_REQUEST:'.length) });
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: msg.slice('NOT_FOUND:'.length) });
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: msg.slice('FORBIDDEN:'.length) });
    console.error('Confirm pickup error:', err);
    return res.status(500).json({ error: 'Yig‘imni tasdiqlashda server xatoligi.' });
  }
});

driverRouter.get('/driver/history', async (req: AuthRequest, res) => {
  try {
    const driverId = req.currentUser!.driverId!;
    const completed = await db
      .select({
        id: wasteReports.id,
        publicCode: wasteReports.publicCode,
        category: wasteReports.category,
        estimatedRange: wasteReports.estimatedRange,
        actualLiters: wasteReports.actualLiters,
        mfyName: mfys.name,
        citizenName: users.fullName,
        updatedAt: wasteReports.updatedAt,
      })
      .from(wasteReports)
      .innerJoin(mfys, eq(wasteReports.mfyId, mfys.id))
      .innerJoin(users, eq(wasteReports.citizenId, users.id))
      .where(and(eq(wasteReports.assignedDriverId, driverId), eq(wasteReports.status, 'completed')))
      .orderBy(desc(wasteReports.updatedAt))
      .limit(100);

    return res.json({ history: completed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Yig‘imlar tarixini yuklashda xatolik.' });
  }
});
