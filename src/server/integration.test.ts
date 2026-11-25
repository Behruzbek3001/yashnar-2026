import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

class SessionClient {
  private cookie = '';

  async request<T = Record<string, unknown>>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ status: number; data: T; raw: Response }> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
    };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const firstPart = setCookie.split(';')[0];
      if (firstPart.startsWith('yashnar_session=')) {
        this.cookie = firstPart;
      }
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? ((await res.json()) as T)
      : ({} as T);

    return { status: res.status, data, raw: res };
  }
}

async function createValidJpegDataUrl(): Promise<string> {
  const buf = await sharp({
    create: {
      width: 320,
      height: 240,
      channels: 3,
      background: { r: 5, g: 150, b: 105 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

test('YASHNAR full backend & Cloud SQL integration acceptance flow', async () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const citizen1 = new SessionClient();
  const citizen2 = new SessionClient();
  const driver = new SessionClient();
  const admin = new SessionClient();

  // 0. Public unauthenticated geography endpoints must return Namangan viloyati & all 14 districts for Sign Up
  const publicGuest = new SessionClient();
  const publicDistRes = await publicGuest.request<{ districts: Array<{ id: number; name: string }> }>(
    '/api/geography/districts'
  );
  assert.equal(publicDistRes.status, 200);
  assert.equal(publicDistRes.data.districts.length, 14, 'Should expose all 14 Namangan districts publicly');
  const firstDistrictId = publicDistRes.data.districts[0].id;

  // 1. Register Citizen 1 — even if client tries to inject role='admin', server must force 'citizen'
  const reg1 = await citizen1.request<{ user: { id: number; role: string; districtId: number; regionId: number } }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Alisher Karimov',
        email: `citizen1.${suffix}@yashnar.test`,
        districtId: firstDistrictId,
        password: 'Password123!',
        passwordConfirmation: 'Password123!',
        phone: '+998901234567',
        role: 'admin',
      }),
    }
  );
  assert.equal(reg1.status, 201, `Expected 201 on register, got ${reg1.status}: ${JSON.stringify(reg1.data)}`);
  assert.equal(reg1.data.user.role, 'citizen', 'Public signup must strictly create citizen role');
  assert.equal(reg1.data.user.districtId, firstDistrictId, 'Signup must persist chosen Namangan district');
  assert.ok(reg1.data.user.regionId > 0, 'Signup must auto-attach Namangan viloyati regionId');

  // Verify Citizen 1 is blocked from Admin & Driver APIs
  const forbiddenAdmin = await citizen1.request('/api/admin/analytics');
  assert.equal(forbiddenAdmin.status, 403);
  const forbiddenDriver = await citizen1.request('/api/driver/dashboard');
  assert.equal(forbiddenDriver.status, 403);

  // 2. Register Citizen 2
  const reg2 = await citizen2.request<{ user: { id: number; role: string } }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Dilnoza Tursunova',
      email: `citizen2.${suffix}@yashnar.test`,
      districtId: firstDistrictId,
      password: 'Password123!',
      passwordConfirmation: 'Password123!',
      phone: '+998907654321',
    }),
  });
  assert.equal(reg2.status, 201);

  // 3. Geography + Cross-User Add-MFY + Normalization Duplicate Check
  const regList = await citizen1.request<{ regions: Array<{ id: number; name: string }> }>(
    '/api/geography/regions'
  );
  assert.equal(regList.status, 200);
  const regionId = regList.data.regions[0].id;

  const customMfyName = `Yangi Bog' ${suffix.slice(-5)}`;
  const addMfyRes = await citizen1.request<{ mfy: { id: number; name: string; status: string } }>(
    '/api/geography/mfys',
    {
      method: 'POST',
      body: JSON.stringify({ districtId: firstDistrictId, name: customMfyName }),
    }
  );
  assert.equal(addMfyRes.status, 201);
  assert.equal(addMfyRes.data.mfy.status, 'pending');
  const createdMfyId = addMfyRes.data.mfy.id;

  // Duplicate normalized spelling (curly apostrophe + extra spaces + uppercase) must be rejected with 409
  const dupMfyRes = await citizen2.request('/api/geography/mfys', {
    method: 'POST',
    body: JSON.stringify({
      districtId: firstDistrictId,
      name: `  ${customMfyName.replace("'", '‘').toUpperCase()}  `,
    }),
  });
  assert.equal(dupMfyRes.status, 409, 'Normalized duplicate MFY must be rejected');

  // Citizen 2 must immediately see Citizen 1's newly added MFY
  const c2MfyList = await citizen2.request<{ mfys: Array<{ id: number; name: string }> }>(
    `/api/geography/mfys?districtId=${firstDistrictId}`
  );
  assert.ok(
    c2MfyList.data.mfys.some((m) => m.id === createdMfyId),
    'New MFY must persist across independent users'
  );

  // Complete onboarding for Citizen 1 (intentionally omitting regionId to verify auto-attach fix)
  const ob1 = await citizen1.request('/api/auth/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Alisher Karimov',
      phone: '+998901234567',
      districtId: firstDistrictId,
      mfyId: createdMfyId,
      publicLeaderboardName: 'Alisher K.',
      leaderboardVisible: true,
    }),
  });
  assert.equal(ob1.status, 200);

  const ob2 = await citizen2.request('/api/auth/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Dilnoza Tursunova',
      phone: '+998907654321',
      regionId,
      districtId: firstDistrictId,
      mfyId: createdMfyId,
      publicLeaderboardName: 'Dilnoza T.',
      leaderboardVisible: true,
    }),
  });
  assert.equal(ob2.status, 200);

  // 4. Real Photo Upload + Private Storage Isolation
  const photoDataUrl = await createValidJpegDataUrl();
  const repRes = await citizen1.request<{ report: { id: number; publicCode: string } }>(
    '/api/citizen/reports',
    {
      method: 'POST',
      body: JSON.stringify({
        category: 'Plastik',
        estimatedRange: '31–60 L',
        description: 'Toza plastik idishlar yig‘ildi',
        address: 'Bog‘ ko‘chasi, 14-uy',
        latitude: 40.999,
        longitude: 71.673,
        photoDataUrl,
      }),
    }
  );
  assert.equal(repRes.status, 201);
  const reportId = repRes.data.report.id;

  // Citizen 1 can view own photo -> 200
  const c1Photo = await citizen1.request(`/api/storage/reports/${reportId}`);
  assert.equal(c1Photo.status, 200);
  // Citizen 2 MUST get 403 on Citizen 1's private photo
  const c2Photo = await citizen2.request(`/api/storage/reports/${reportId}`);
  assert.equal(c2Photo.status, 403, 'Private report photo must be blocked for unrelated citizens');

  // 5. Admin logs in, approves MFY, assigns Driver to this MFY, and verifies audit log
  const adminLogin = await admin.request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@yashnar.uz', password: 'AdminYashnar2026!' }),
  });
  assert.equal(adminLogin.status, 200);

  // Admin can view Citizen 1's photo
  const adminPhoto = await admin.request(`/api/storage/reports/${reportId}`);
  assert.equal(adminPhoto.status, 200);

  const approveMfy = await admin.request(`/api/admin/mfys/${createdMfyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'approved', workloadThresholdLiters: 500 }),
  });
  assert.equal(approveMfy.status, 200);

  // Find reference driver and assign the new MFY
  const driversList = await admin.request<{
    drivers: Array<{ id: number; assignedMfys: Array<{ mfyId: number }> }>;
  }>('/api/admin/drivers');
  assert.equal(driversList.status, 200);
  const refDriver = driversList.data.drivers[0];
  assert.ok(refDriver, 'Reference driver must exist');

  const prevMfyIds = refDriver.assignedMfys.map((m) => m.mfyId);
  const assignRes = await admin.request(`/api/admin/drivers/${refDriver.id}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ mfyIds: Array.from(new Set([...prevMfyIds, createdMfyId])) }),
  });
  assert.equal(assignRes.status, 200);

  // 6. Driver logs in, starts trip, cannot start 2nd trip, sends GPS, verifies throttle
  const driverLogin = await driver.request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'driver@yashnar.uz', password: 'DriverYashnar2026!' }),
  });
  assert.equal(driverLogin.status, 200);

  // Clean up any pre-existing active trip first if one existed
  const existingTrips = await driver.request<{ trips: Array<{ id: number; status: string }> }>(
    '/api/driver/trips'
  );
  for (const t of existingTrips.data.trips || []) {
    if (t.status === 'active') {
      await driver.request(`/api/driver/trips/${t.id}/end`, { method: 'POST' });
    }
  }

  const startTrip = await driver.request<{ trip: { id: number } }>('/api/driver/trips/start', {
    method: 'POST',
    body: JSON.stringify({ mfyId: createdMfyId }),
  });
  assert.equal(startTrip.status, 201);
  const tripId = startTrip.data.trip.id;

  // Starting a second active trip must fail with 409
  const secondTrip = await driver.request('/api/driver/trips/start', {
    method: 'POST',
    body: JSON.stringify({ mfyId: createdMfyId }),
  });
  assert.equal(secondTrip.status, 409, 'Driver must not have >1 active trip');

  // Assigned driver can view report photo
  const driverPhoto = await driver.request(`/api/storage/reports/${reportId}`);
  assert.equal(driverPhoto.status, 200);

  // Citizen 1 receives persisted notification about trip start
  const notifs = await citizen1.request<{ notifications: Array<{ type: string }> }>('/api/notifications');
  assert.ok(
    notifs.data.notifications.some((n) => n.type === 'driver_trip_started'),
    'Citizen must receive persisted trip start notification'
  );

  // Driver sends GPS -> accepted, immediate repeat within 15s -> throttled (accepted=false)
  const gps1 = await driver.request<{ accepted: boolean }>('/api/driver/location', {
    method: 'POST',
    body: JSON.stringify({ latitude: 40.9992, longitude: 71.6731, accuracyMeters: 15 }),
  });
  assert.equal(gps1.status, 200);
  assert.equal(gps1.data.accepted, true);

  const gps2 = await driver.request<{ accepted: boolean }>('/api/driver/location', {
    method: 'POST',
    body: JSON.stringify({ latitude: 40.9992, longitude: 71.6731, accuracyMeters: 15 }),
  });
  assert.equal(gps2.status, 200);
  assert.equal(gps2.data.accepted, false, 'Immediate duplicate GPS within 15s must be throttled');

  // Citizen 1 sees active driver on MFY map
  const c1Map = await citizen1.request<{ drivers: Array<{ tripId: number }> }>('/api/citizen/map');
  assert.ok(c1Map.data.drivers.some((d) => d.tripId === tripId));

  // 7. Personal QR Rotate, Revoke, Scan without Reward, Atomic Confirm + Idempotent Replay
  const qr1 = await citizen1.request<{ qrPayload: string }>('/api/citizen/qr/rotate', {
    method: 'POST',
  });
  assert.equal(qr1.status, 200);
  const revokedToken = qr1.data.qrPayload;

  // Rotating again must revoke the previous token
  const qr2 = await citizen1.request<{ qrPayload: string }>('/api/citizen/qr/rotate', {
    method: 'POST',
  });
  assert.equal(qr2.status, 200);
  const activeToken = qr2.data.qrPayload;
  assert.notEqual(revokedToken, activeToken);

  const verifyOld = await driver.request('/api/driver/scan/verify', {
    method: 'POST',
    body: JSON.stringify({ qrToken: revokedToken }),
  });
  assert.equal(verifyOld.status, 400, 'Revoked QR token must be rejected');

  // Verify active token — scan alone MUST NOT grant XP or coins
  const verifyOk = await driver.request<{
    eligiblePickups: Array<{ id: number }>;
  }>('/api/driver/scan/verify', {
    method: 'POST',
    body: JSON.stringify({ qrToken: activeToken }),
  });
  assert.equal(verifyOk.status, 200);
  assert.ok(verifyOk.data.eligiblePickups.some((p) => p.id === reportId));

  const walletBeforeConfirm = await citizen1.request<{ wallet: { coinBalance: number; totalXp: number } }>(
    '/api/citizen/wallet'
  );
  assert.equal(walletBeforeConfirm.data.wallet.totalXp, 0, 'QR scan alone must not award XP');
  assert.equal(walletBeforeConfirm.data.wallet.coinBalance, 0, 'QR scan alone must not award coins');

  // Invalid actualLiters (<= 0) must be rejected
  const badConfirm = await driver.request('/api/driver/scan/confirm', {
    method: 'POST',
    body: JSON.stringify({
      qrToken: activeToken,
      reportId,
      actualLiters: 0,
      idempotencyKey: `bad-key-${suffix}`,
    }),
  });
  assert.equal(badConfirm.status, 400);

  // Valid confirmation awards XP + coins exactly once
  const confirmKey = `confirm-key-${suffix}`;
  const goodConfirm = await driver.request<{ xpGranted: number; coinsGranted: number }>(
    '/api/driver/scan/confirm',
    {
      method: 'POST',
      body: JSON.stringify({
        qrToken: activeToken,
        reportId,
        actualLiters: 42.5,
        idempotencyKey: confirmKey,
      }),
    }
  );
  assert.equal(goodConfirm.status, 200);
  assert.ok(goodConfirm.data.xpGranted > 0);
  assert.ok(goodConfirm.data.coinsGranted > 0);

  // Replay with SAME key AND replay with DIFFERENT key must NOT grant duplicate rewards
  const replay1 = await driver.request<{ duplicate: boolean; xpGranted: number }>(
    '/api/driver/scan/confirm',
    {
      method: 'POST',
      body: JSON.stringify({
        qrToken: activeToken,
        reportId,
        actualLiters: 42.5,
        idempotencyKey: confirmKey,
      }),
    }
  );
  assert.equal(replay1.status, 200);
  assert.equal(replay1.data.duplicate, true);
  assert.equal(replay1.data.xpGranted, 0);

  const replay2 = await driver.request<{ duplicate: boolean; xpGranted: number }>(
    '/api/driver/scan/confirm',
    {
      method: 'POST',
      body: JSON.stringify({
        qrToken: activeToken,
        reportId,
        actualLiters: 42.5,
        idempotencyKey: `different-key-${suffix}`,
      }),
    }
  );
  assert.equal(replay2.status, 200);
  assert.equal(replay2.data.duplicate, true);
  assert.equal(replay2.data.xpGranted, 0);

  // End trip -> GPS location must be deleted immediately
  const endTrip = await driver.request(`/api/driver/trips/${tripId}/end`, { method: 'POST' });
  assert.equal(endTrip.status, 200);

  const c1MapAfterEnd = await citizen1.request<{ drivers: Array<{ tripId: number }> }>('/api/citizen/map');
  assert.equal(
    c1MapAfterEnd.data.drivers.some((d) => d.tripId === tripId),
    false,
    'Driver location must be deleted immediately on trip end'
  );

  // 8. Quests: exactly 1 daily quiz from 100-question default bank; never leak correctOptionIndex
  const questsRes = await citizen1.request<{
    quests: Array<{
      id: number;
      questType: string;
      quizDayNumber?: number | null;
      quizTotalCount?: number | null;
      correctOptionIndex?: number;
    }>;
  }>('/api/citizen/quests');
  assert.equal(questsRes.status, 200);
  const quizQuests = questsRes.data.quests.filter((q) => q.questType === 'quiz');
  assert.equal(quizQuests.length, 1, 'Exactly 1 daily quiz question should be posted per day');
  const quizQuest = quizQuests[0];
  assert.equal(quizQuest.quizTotalCount, 100, 'Daily quiz bank must have 100 default questions');
  assert.ok((quizQuest.quizDayNumber ?? 0) >= 1 && (quizQuest.quizDayNumber ?? 0) <= 100);
  assert.equal(
    'correctOptionIndex' in quizQuest,
    false,
    'correctOptionIndex must NEVER be exposed to the client'
  );

  // 9. Eco Market Transactional Redemption & Idempotent Admin Refund
  // Create a low-cost test reward (5 coins) so Citizen 1 (who earned 10 coins from verified pickup) can redeem it
  const createReward = await admin.request<{ reward: { id: number; stockQuantity: number; coinCost: number } }>(
    '/api/admin/rewards',
    {
      method: 'POST',
      body: JSON.stringify({
        title: `Test Eko Sovrin ${suffix.slice(-4)}`,
        description: 'Integratsiya testi uchun sovrin',
        coinCost: 5,
        stockQuantity: 3,
        fulfillmentConditions: 'Sinov',
      }),
    }
  );
  assert.equal(createReward.status, 201);
  const testRewardId = createReward.data.reward.id;

  const walletBeforeRedeem = await citizen1.request<{ wallet: { coinBalance: number } }>(
    '/api/citizen/wallet'
  );
  const balanceBeforeRedeem = walletBeforeRedeem.data.wallet.coinBalance;
  assert.ok(balanceBeforeRedeem >= 5);

  // Client attempts to spoof coinCost=1 — server MUST charge authoritative DB price (5)
  const redeemRes = await citizen1.request<{ redemption: { id: number; coinCostSnapshot: number } }>(
    '/api/citizen/market/redeem',
    {
      method: 'POST',
      body: JSON.stringify({
        rewardId: testRewardId,
        coinCost: 1,
        idempotencyKey: `redeem-${suffix}`,
      }),
    }
  );
  assert.equal(redeemRes.status, 201);
  assert.equal(redeemRes.data.redemption.coinCostSnapshot, 5, 'Server must ignore client-supplied price');
  const redemptionId = redeemRes.data.redemption.id;

  const walletAfterRedeem = await citizen1.request<{ wallet: { coinBalance: number } }>(
    '/api/citizen/wallet'
  );
  assert.equal(walletAfterRedeem.data.wallet.coinBalance, balanceBeforeRedeem - 5);

  // Admin refunds TWICE — coins and stock must be restored EXACTLY ONCE
  const refund1 = await admin.request<{ alreadyRefunded: boolean }>(
    `/api/admin/redemptions/${redemptionId}/refund`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: 'Sinov qaytarish' }),
    }
  );
  assert.equal(refund1.status, 200);
  assert.equal(refund1.data.alreadyRefunded, false);

  const refund2 = await admin.request<{ alreadyRefunded: boolean }>(
    `/api/admin/redemptions/${redemptionId}/refund`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: 'Takroriy urinish' }),
    }
  );
  assert.equal(refund2.status, 200);
  assert.equal(refund2.data.alreadyRefunded, true, 'Duplicate refund must be idempotent');

  const walletAfterRefund = await citizen1.request<{ wallet: { coinBalance: number } }>(
    '/api/citizen/wallet'
  );
  assert.equal(
    walletAfterRefund.data.wallet.coinBalance,
    balanceBeforeRedeem,
    'Coins must be restored exactly once'
  );

  // Verify Audit Logs captured admin actions
  const auditRes = await admin.request<{ logs: Array<{ action: string }> }>('/api/admin/audit');
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.data.logs.some((l) => l.action === 'redemption_refunded'));

  // Clean up temporary test reward so Eco Market catalog stays spotless
  await admin.request(`/api/admin/rewards/${testRewardId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: false }),
  });
});
