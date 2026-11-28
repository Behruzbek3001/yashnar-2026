import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.ts';
import { driverAssignments, drivers, reportStatusEvents, users, wasteReports } from '../db/schema.ts';
import { requireAuth, type AuthRequest } from './auth.ts';
import { createNotificationTx, emitAfterCommit, recordAuditLogTx } from './services.ts';

const rows = <T,>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

export async function ensureModerationTables(): Promise<void> {
  // Existing reports count as approved; new ones start as pending.
  await db.execute(sql`ALTER TABLE waste_reports ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'`);
  await db.execute(sql`ALTER TABLE waste_reports ALTER COLUMN moderation_status SET DEFAULT 'pending'`);
  await db.execute(sql`ALTER TABLE waste_reports ADD COLUMN IF NOT EXISTS ai_verdict text`);
  await db.execute(sql`ALTER TABLE waste_reports ADD COLUMN IF NOT EXISTS gps_accuracy double precision`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS report_comments (
    id serial PRIMARY KEY,
    report_id integer NOT NULL REFERENCES waste_reports(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
}

// ---------------------------------------------------------------------------
// AI photo check
// ---------------------------------------------------------------------------
export interface PhotoVerdict {
  isTrash: boolean;
  isScreenPhoto: boolean;
  confidence: number;
  reason: string;
  model?: string;
}

const PROMPT = `You check photos sent to a city waste-collection app in Uzbekistan.
Answer ONLY with JSON: {"isTrash": boolean, "isScreenPhoto": boolean, "confidence": number 0..1, "reason": "short reason in Uzbek (latin)"}.
- isTrash: true only if the photo clearly shows real garbage/waste (bags, litter, dumped rubbish, overflowing bins, construction or garden waste) in a real outdoor or indoor place.
- isScreenPhoto: true if this is a photo OF a screen or printout (phone/monitor/TV/laptop showing an image): look for moiré patterns, visible pixel grid, screen bezels or edges, glare/reflections on glass, status bars, browser UI, watermarks, stock-photo look, or flat unnatural lighting.
- confidence: how sure you are about both answers together.`;

/** Returns null when the AI is not configured or fails (then the admin decides manually). */
export async function analyzeTrashPhoto(dataUrl: string): Promise<PhotoVerdict | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  for (const model of ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType: m[1], data: m[2] } }] }],
        config: { responseMimeType: 'application/json', temperature: 0 },
      });
      const parsed = JSON.parse(resp.text ?? '{}');
      if (typeof parsed.isTrash !== 'boolean') continue;
      return {
        isTrash: parsed.isTrash,
        isScreenPhoto: Boolean(parsed.isScreenPhoto),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        reason: String(parsed.reason ?? '').slice(0, 300),
        model,
      };
    } catch (err) {
      console.warn(`Photo check with ${model} failed:`, String((err as Error).message).slice(0, 200));
    }
  }
  return null;
}

/** Rejection message when the AI is confident the photo is not acceptable, else null. */
export function verdictRejection(v: PhotoVerdict | null): string | null {
  if (!v) return null;
  if (v.isScreenPhoto && v.confidence >= 0.6) {
    return 'Rasm ekrandan (telefon/kompyuter) olinganga o‘xshaydi. Iltimos, chiqindining o‘zini joyida suratga oling.';
  }
  if (!v.isTrash && v.confidence >= 0.7) {
    return `Rasmda chiqindi aniqlanmadi${v.reason ? ` (${v.reason})` : ''}. Iltimos, chiqindini aniq suratga oling.`;
  }
  return null;
}

// Namangan region bounding box (generous).
export function insideNamangan(lat: number, lng: number): boolean {
  return lat >= 40.5 && lat <= 41.8 && lng >= 70.2 && lng <= 72.5;
}

// ---------------------------------------------------------------------------
// Access, comments, approve/decline
// ---------------------------------------------------------------------------
async function canAccessReport(u: NonNullable<AuthRequest['currentUser']>, reportId: number) {
  const [r] = await db
    .select({ id: wasteReports.id, citizenId: wasteReports.citizenId, mfyId: wasteReports.mfyId, publicCode: wasteReports.publicCode })
    .from(wasteReports)
    .where(eq(wasteReports.id, reportId))
    .limit(1);
  if (!r) return null;
  if (u.role === 'admin' || r.citizenId === u.id) return r;
  if (u.role === 'driver' && u.driverId) {
    const [a] = await db
      .select({ id: driverAssignments.id })
      .from(driverAssignments)
      .where(and(eq(driverAssignments.driverId, u.driverId), eq(driverAssignments.mfyId, r.mfyId), eq(driverAssignments.isActive, true)))
      .limit(1);
    if (a) return r;
  }
  return null;
}

export const reportModerationRouter = Router();

reportModerationRouter.get('/reports/:id/comments', requireAuth, async (req: AuthRequest, res) => {
  const report = await canAccessReport(req.currentUser!, Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'Murojaat topilmadi.' });
  const list = rows<{ id: number; role: string; body: string; created_at: string | Date; author: string }>(
    await db.execute(sql`SELECT c.id, c.role, c.body, c.created_at, u.full_name AS author
      FROM report_comments c JOIN users u ON u.id = c.user_id
      WHERE c.report_id = ${report.id} ORDER BY c.created_at ASC`)
  );
  return res.json({
    comments: list.map((c) => ({ id: c.id, role: c.role, body: c.body, author: c.author, createdAt: new Date(c.created_at).toISOString() })),
  });
});

reportModerationRouter.post('/reports/:id/comments', requireAuth, async (req: AuthRequest, res) => {
  const u = req.currentUser!;
  const report = await canAccessReport(u, Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'Murojaat topilmadi.' });
  const body = String(req.body?.body ?? '').trim();
  if (body.length < 1 || body.length > 1000) return res.status(400).json({ error: 'Izoh 1–1000 belgidan iborat bo‘lishi kerak.' });
  await db.transaction(async (tx) => {
    await tx.execute(sql`INSERT INTO report_comments (report_id, user_id, role, body) VALUES (${report.id}, ${u.id}, ${u.role}, ${body})`);
    if (report.citizenId !== u.id) {
      await createNotificationTx(tx, {
        userId: report.citizenId,
        type: 'report_comment',
        title: `Murojaatingizga izoh: ${report.publicCode}`,
        body: body.slice(0, 140),
        relatedEntityType: 'report',
        relatedEntityId: String(report.id),
      });
    }
  });
  emitAfterCommit({ keys: [`report-comments-${report.id}`, 'notifications'], userIds: [report.citizenId], includeAdmins: true });
  return res.status(201).json({ ok: true });
});

reportModerationRouter.post('/admin/reports/:id/moderate', requireAuth, async (req: AuthRequest, res) => {
  const u = req.currentUser!;
  if (u.role !== 'admin') return res.status(403).json({ error: 'Ushbu bo‘limga kirish uchun ruxsatingiz yo‘q.' });
  const id = Number(req.params.id);
  const decision = req.body?.decision === 'approve' ? 'approve' : req.body?.decision === 'reject' ? 'reject' : null;
  const reason = String(req.body?.reason ?? '').trim().slice(0, 500);
  if (!decision) return res.status(400).json({ error: 'Qaror noto‘g‘ri.' });
  if (decision === 'reject' && reason.length < 3) return res.status(400).json({ error: 'Rad etish sababini yozing.' });

  const [r] = await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1);
  if (!r) return res.status(404).json({ error: 'Murojaat topilmadi.' });
  if (['completed', 'cancelled'].includes(r.status)) return res.status(409).json({ error: 'Bu murojaat allaqachon yopilgan.' });

  const newStatus = decision === 'approve' ? 'assigned' : 'cancelled';
  const driverUserIds: number[] = [];
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE waste_reports SET moderation_status = ${decision === 'approve' ? 'approved' : 'rejected'}, status = ${newStatus}, updated_at = now() WHERE id = ${id}`
    );
    await tx.insert(reportStatusEvents).values({
      reportId: id,
      status: newStatus,
      actorUserId: u.id,
      note: decision === 'approve' ? 'Administrator tomonidan tasdiqlandi.' : `Administrator rad etdi: ${reason}`,
    });
    if (reason) {
      await tx.execute(sql`INSERT INTO report_comments (report_id, user_id, role, body) VALUES (${id}, ${u.id}, 'admin', ${reason})`);
    }
    await createNotificationTx(tx, {
      userId: r.citizenId,
      type: decision === 'approve' ? 'report_approved' : 'report_rejected',
      title: decision === 'approve' ? `Murojaat tasdiqlandi: ${r.publicCode}` : `Murojaat rad etildi: ${r.publicCode}`,
      body: decision === 'approve' ? 'Murojaatingiz tasdiqlandi va haydovchiga yuborildi.' : `Sabab: ${reason}`,
      relatedEntityType: 'report',
      relatedEntityId: String(id),
    });
    if (decision === 'approve') {
      const assigned = await tx
        .select({ userId: drivers.userId })
        .from(driverAssignments)
        .innerJoin(drivers, eq(driverAssignments.driverId, drivers.id))
        .where(and(eq(driverAssignments.mfyId, r.mfyId), eq(driverAssignments.isActive, true), eq(drivers.approvalStatus, 'approved')));
      for (const d of assigned) {
        driverUserIds.push(d.userId);
        await createNotificationTx(tx, {
          userId: d.userId,
          type: 'new_report',
          title: 'Yangi tasdiqlangan murojaat',
          body: `${r.category} (${r.estimatedRange}) — ${r.address ?? ''}`.slice(0, 140),
          relatedEntityType: 'report',
          relatedEntityId: String(id),
        });
      }
    }
    await recordAuditLogTx(tx, {
      actorUserId: u.id,
      actorRole: 'admin',
      action: decision === 'approve' ? 'report_approved' : 'report_rejected',
      targetType: 'report',
      targetId: String(id),
      metadata: { reason },
    });
  });
  emitAfterCommit({
    keys: ['admin-reports', 'citizen-reports', 'citizen-dashboard', 'driver-reports', 'driver-map', 'driver-dashboard', 'notifications'],
    userIds: [r.citizenId, ...driverUserIds],
    includeAdmins: true,
  });
  return res.json({ ok: true, status: newStatus });
});

void users;

/** Admin tool: run the AI photo check on any image (for testing the detector). */
reportModerationRouter.post('/admin/photo-check', requireAuth, async (req: AuthRequest, res) => {
  if (req.currentUser!.role !== 'admin') return res.status(403).json({ error: 'Ruxsat yo‘q.' });
  const dataUrl = String(req.body?.photoDataUrl ?? '');
  if (!dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'Rasm yuboring.' });
  const verdict = await analyzeTrashPhoto(dataUrl);
  return res.json({ verdict, rejection: verdictRejection(verdict) });
});

/** ONE-TIME admin tool: delete every citizen and driver account with all their data. Admins are kept. */
reportModerationRouter.post('/admin/reset-non-admin-users', requireAuth, async (req: AuthRequest, res) => {
  if (req.currentUser!.role !== 'admin') return res.status(403).json({ error: 'Ruxsat yo‘q.' });
  if (req.body?.confirm !== 'DELETE ALL CITIZENS AND DRIVERS') return res.status(400).json({ error: 'Tasdiqlash matni noto‘g‘ri.' });
  try {
    const counts = await db.transaction(async (tx) => {
      const n = async (q: ReturnType<typeof sql>) => {
        const r = (await tx.execute(q)) as unknown as { rowCount?: number; affectedRows?: number };
        return r.rowCount ?? r.affectedRows ?? 0;
      };
      await tx.execute(sql`CREATE TEMP TABLE t_users ON COMMIT DROP AS SELECT id FROM users WHERE role IN ('citizen', 'driver')`);
      await tx.execute(sql`CREATE TEMP TABLE t_drivers ON COMMIT DROP AS SELECT id FROM drivers WHERE user_id IN (SELECT id FROM t_users)`);
      await tx.execute(sql`DELETE FROM qr_scan_events WHERE citizen_id IN (SELECT id FROM t_users) OR driver_id IN (SELECT id FROM t_drivers)`);
      await tx.execute(sql`UPDATE waste_reports SET assigned_driver_id = NULL, trip_id = NULL WHERE assigned_driver_id IN (SELECT id FROM t_drivers) OR trip_id IN (SELECT id FROM driver_trips WHERE driver_id IN (SELECT id FROM t_drivers))`);
      await tx.execute(sql`DELETE FROM report_status_events WHERE actor_user_id IN (SELECT id FROM t_users)`);
      await tx.execute(sql`DELETE FROM inventory_events WHERE actor_user_id IN (SELECT id FROM t_users) OR redemption_id IN (SELECT id FROM redemptions WHERE user_id IN (SELECT id FROM t_users))`);
      await tx.execute(sql`DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM t_users)`);
      await tx.execute(sql`UPDATE disputes SET resolved_by = NULL WHERE resolved_by IN (SELECT id FROM t_users)`);
      await tx.execute(sql`DELETE FROM driver_assignments WHERE assigned_by IN (SELECT id FROM t_users)`);
      await tx.execute(sql`UPDATE drivers SET approved_by = NULL WHERE approved_by IN (SELECT id FROM t_users)`);
      await tx.execute(sql`DELETE FROM sms_daily WHERE user_id IN (SELECT id FROM t_users)`);
      const users = await n(sql`DELETE FROM users WHERE id IN (SELECT id FROM t_users)`);
      return { users };
    });
    emitAfterCommit({ keys: ['admin-drivers', 'admin-citizens', 'admin-reports'], includeAdmins: true });
    return res.json({ ok: true, deleted: counts });
  } catch (err) {
    console.error('Reset failed:', err);
    return res.status(500).json({ error: String((err as Error).message).slice(0, 300) });
  }
});
