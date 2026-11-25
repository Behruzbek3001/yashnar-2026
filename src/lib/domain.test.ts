import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGeographyName,
  calculateLevelFromXp,
  getLevelThreshold,
  getTashkentDateString,
  getDailyRotationIndex,
  calculateStreak,
  getStreakMilestoneReward,
  calculateWorkload,
  shouldSendGpsUpdate,
  isLocationStale,
  haversineMeters,
  registerSchema,
  onboardingSchema,
  actualVolumeSchema,
  disputeSchema,
} from './domain';
import { DAILY_QUIZ_BANK } from '../server/quiz-bank';

test('MFY normalization unifies Unicode, apostrophes, punctuation, case, and whitespace', () => {
  assert.equal(normalizeGeographyName("O‘zbekiston   MFY!"), "o'zbekiston mfy");
  assert.equal(normalizeGeographyName("O'zbekiston MFY"), "o'zbekiston mfy");
  assert.equal(normalizeGeographyName("OʻZBEKISTON, mfy"), "o'zbekiston mfy");
  assert.equal(normalizeGeographyName("G‘afur G’ulom  "), "g'afur g'ulom");
  assert.equal(
    normalizeGeographyName("Bog‘ishamol"),
    normalizeGeographyName("bog'ishamol")
  );
});

test('Level thresholds follow 25 * (n - 1)^2 and exact level titles across 100 levels', () => {
  assert.equal(getLevelThreshold(1), 0);
  assert.equal(getLevelThreshold(2), 25);
  assert.equal(getLevelThreshold(3), 100);
  assert.equal(getLevelThreshold(10), 2025);
  assert.equal(getLevelThreshold(100), 25 * 99 * 99);

  assert.equal(calculateLevelFromXp(0).level, 1);
  assert.equal(calculateLevelFromXp(0).title, 'Eco Beginner');
  assert.equal(calculateLevelFromXp(24).level, 1);
  assert.equal(calculateLevelFromXp(25).level, 2);
  assert.equal(calculateLevelFromXp(100).level, 3);
  assert.equal(calculateLevelFromXp(2025).level, 10);
  assert.equal(calculateLevelFromXp(2025).title, 'Eco Beginner');
  assert.equal(calculateLevelFromXp(2500).level, 11);
  assert.equal(calculateLevelFromXp(2500).title, 'Eco Explorer');
  assert.equal(calculateLevelFromXp(getLevelThreshold(26)).title, 'Eco Guardian');
  assert.equal(calculateLevelFromXp(getLevelThreshold(51)).title, 'Eco Champion');
  assert.equal(calculateLevelFromXp(getLevelThreshold(76)).title, 'Eco Legend');
  assert.equal(calculateLevelFromXp(99999999).level, 100);
});

test('Asia/Tashkent daily boundary switches at 00:00 UTC+5 (19:00 UTC)', () => {
  const beforeMidnightTashkent = new Date('2026-11-20T18:59:59Z');
  const atMidnightTashkent = new Date('2026-11-20T19:00:00Z');
  assert.equal(getTashkentDateString(beforeMidnightTashkent), '2026-11-20');
  assert.equal(getTashkentDateString(atMidnightTashkent), '2026-11-21');
});

test('Streak calculation deduplicates same-day events and stays active through yesterday', () => {
  const resToday = calculateStreak(
    ['2026-11-18', '2026-11-19', '2026-11-19', '2026-11-20'],
    '2026-11-20'
  );
  assert.equal(resToday.currentStreak, 3);
  assert.equal(resToday.longestStreak, 3);

  const resYesterday = calculateStreak(['2026-11-18', '2026-11-19'], '2026-11-20');
  assert.equal(resYesterday.currentStreak, 2);

  const resBroken = calculateStreak(['2026-11-17', '2026-11-18'], '2026-11-20');
  assert.equal(resBroken.currentStreak, 0);
  assert.equal(resBroken.longestStreak, 2);

  assert.deepEqual(getStreakMilestoneReward(7), { milestoneCode: 'streak_7', xp: 20, coins: 5 });
  assert.deepEqual(getStreakMilestoneReward(30), { milestoneCode: 'streak_30', xp: 100, coins: 20 });
  assert.equal(getStreakMilestoneReward(8), null);
});

test('MFY workload formula keeps uncapped analytics value and caps visual bar at 100%', () => {
  const normal = calculateWorkload(300, 500);
  assert.equal(normal.uncappedPercent, 60);
  assert.equal(normal.visualPercent, 60);
  assert.equal(normal.recommendedCollection, false);

  const high = calculateWorkload(305, 500);
  assert.equal(high.uncappedPercent, 61);
  assert.equal(high.recommendedCollection, true);

  const overflow = calculateWorkload(750, 500);
  assert.equal(overflow.uncappedPercent, 150);
  assert.equal(overflow.visualPercent, 100);
  assert.equal(overflow.recommendedCollection, true);

  assert.throws(() => calculateWorkload(100, 0));
  assert.throws(() => calculateWorkload(100, -50));
});

test('GPS update policy enforces 15s rate limit, 20m movement, 60s heartbeat, 120s staleness', () => {
  const base = { lat: 40.9983, lng: 71.6726, timestampMs: 1_000_000 };
  assert.equal(shouldSendGpsUpdate(null, base).allow, true);

  // Too soon (<15s) even with large movement
  assert.equal(
    shouldSendGpsUpdate(base, { lat: 41.005, lng: 71.6726, timestampMs: base.timestampMs + 10_000 })
      .allow,
    false
  );

  // >=15s and >=20m movement -> allow
  const movedLat = 40.9986; // ~33 meters north
  assert.ok(haversineMeters(base.lat, base.lng, movedLat, base.lng) > 20);
  assert.equal(
    shouldSendGpsUpdate(base, { lat: movedLat, lng: base.lng, timestampMs: base.timestampMs + 16_000 })
      .reason,
    'movement'
  );

  // >=15s, stationary (<20m), <60s -> reject
  assert.equal(
    shouldSendGpsUpdate(base, { lat: base.lat, lng: base.lng, timestampMs: base.timestampMs + 30_000 })
      .allow,
    false
  );

  // >=60s stationary -> allow heartbeat
  assert.equal(
    shouldSendGpsUpdate(base, { lat: base.lat, lng: base.lng, timestampMs: base.timestampMs + 60_000 })
      .reason,
    'heartbeat'
  );

  assert.equal(isLocationStale(base.timestampMs, base.timestampMs + 119_000), false);
  assert.equal(isLocationStale(base.timestampMs, base.timestampMs + 121_000), true);
});

test('Validation schemas enforce Uzbek phone, districtId, password length, onboarding without regionId, actual volume, and dispute reason', () => {
  assert.equal(
    registerSchema.safeParse({
      fullName: 'Alisher Karimov',
      email: 'alisher@example.com',
      districtId: 1,
      password: 'Password1234!',
      passwordConfirmation: 'Password1234!',
      phone: '+998901234567',
    }).success,
    true
  );

  // Missing districtId must fail
  assert.equal(
    registerSchema.safeParse({
      fullName: 'Alisher Karimov',
      email: 'alisher@example.com',
      districtId: 0,
      password: 'Password1234!',
      passwordConfirmation: 'Password1234!',
      phone: '+998901234567',
    }).success,
    false
  );

  assert.equal(
    registerSchema.safeParse({
      fullName: 'Alisher Karimov',
      email: 'alisher@example.com',
      districtId: 1,
      password: 'short',
      passwordConfirmation: 'short',
      phone: '+998901234567',
    }).success,
    false
  );

  // Onboarding must succeed without explicit regionId (Namangan viloyati auto-resolved)
  assert.equal(
    onboardingSchema.safeParse({
      fullName: 'Alisher Karimov',
      phone: '+998901234567',
      districtId: 2,
      mfyId: 5,
      publicLeaderboardName: 'Alisher K.',
      leaderboardVisible: true,
    }).success,
    true
  );

  assert.equal(actualVolumeSchema.safeParse(0).success, false);
  assert.equal(actualVolumeSchema.safeParse(-5).success, false);
  assert.equal(actualVolumeSchema.safeParse(100001).success, false);
  assert.equal(actualVolumeSchema.safeParse(Number.NaN).success, false);
  assert.equal(actualVolumeSchema.safeParse(45.5).success, true);

  assert.equal(disputeSchema.safeParse({ reason: 'qisqa' }).success, false);
  assert.equal(
    disputeSchema.safeParse({ reason: 'Haydovchi kelmadi va hajm noto‘g‘ri kiritildi.' }).success,
    true
  );
});

test('100-question default daily quiz bank is complete and rotates 1 question per day deterministically', () => {
  assert.equal(DAILY_QUIZ_BANK.length, 100);
  const codes = new Set(DAILY_QUIZ_BANK.map((q) => q.templateCode));
  const questions = new Set(DAILY_QUIZ_BANK.map((q) => q.questionText));
  assert.equal(codes.size, 100, 'All 100 quiz template codes must be unique');
  assert.equal(questions.size, 100, 'All 100 quiz questions must be unique');

  for (const item of DAILY_QUIZ_BANK) {
    assert.equal(item.options.length, 4);
    assert.ok(item.correctOptionIndex >= 0 && item.correctOptionIndex <= 3);
  }

  const day1 = getDailyRotationIndex('2026-01-01', 100);
  const day2 = getDailyRotationIndex('2026-01-02', 100);
  const day100 = getDailyRotationIndex('2026-04-10', 100);
  const day101 = getDailyRotationIndex('2026-04-11', 100);
  assert.equal(day1, 0);
  assert.equal(day2, 1);
  assert.equal(day100, 99);
  assert.equal(day101, 0, 'Rotation should wrap cleanly back to index 0 after 100 days');
});
