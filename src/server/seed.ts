import { eq, inArray, sql } from 'drizzle-orm';
import { db, ensureSchemaReady } from '../db/index.ts';
import {
  regions,
  districts,
  mfys,
  levels,
  rewardRules,
  quests,
  ecoFacts,
  marketRewards,
  systemSettings,
  users,
  wallets,
  drivers,
  driverAssignments,
} from '../db/schema.ts';
import {
  DEFAULT_VOLUME_ESTIMATES,
  getLevelThreshold,
  getLevelTitle,
  normalizeGeographyName,
} from '../lib/domain.ts';
import { hashPassword } from './crypto.ts';
import { DAILY_QUIZ_BANK } from './quiz-bank.ts';

let seedPromise: Promise<void> | null = null;
let seeded = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  if (!seedPromise) {
    seedPromise = runReferenceSeed()
      .then(() => {
        seeded = true;
      })
      .catch((err) => {
        seedPromise = null;
        throw err;
      });
  }
  return seedPromise;
}

export async function runReferenceSeed(): Promise<void> {
  await ensureSchemaReady();

  // 1. Seed Namangan viloyati & its districts
  const [region] = await db
    .insert(regions)
    .values({ name: 'Namangan viloyati', code: 'NAM' })
    .onConflictDoUpdate({
      target: regions.code,
      set: { name: 'Namangan viloyati' },
    })
    .returning();

  const namanganDistricts = [
    'Namangan shahri',
    'Davlatobod tumani',
    'Yangi Namangan tumani',
    'Chortoq tumani',
    'Chust tumani',
    'Kosonsoy tumani',
    'Mingbuloq tumani',
    'Namangan tumani',
    'Norin tumani',
    'Pop tumani',
    'To‘raqo‘rg‘on tumani',
    'Uchqo‘rg‘on tumani',
    'Uychi tumani',
    'Yangiqo‘rg‘on tumani',
  ];

  const districtRows: { id: number; name: string }[] = [];
  for (const name of namanganDistricts) {
    const norm = normalizeGeographyName(name);
    const [row] = await db
      .insert(districts)
      .values({ regionId: region.id, name, normalizedName: norm, isActive: true })
      .onConflictDoUpdate({
        target: [districts.regionId, districts.normalizedName],
        set: { name },
      })
      .returning({ id: districts.id, name: districts.name });
    districtRows.push(row);
  }

  const namanganCity = districtRows.find((d) => d.name === 'Namangan shahri') || districtRows[0];
  const davlatobod = districtRows.find((d) => d.name === 'Davlatobod tumani') || districtRows[0];

  // 2. Seed initial approved MFYs
  const seedMfys = [
    { districtId: namanganCity.id, name: 'Boburshoh MFY', threshold: 400 },
    { districtId: namanganCity.id, name: 'Navbahor MFY', threshold: 500 },
    { districtId: namanganCity.id, name: 'Do‘stlik MFY', threshold: 450 },
    { districtId: davlatobod.id, name: 'Gulobod MFY', threshold: 500 },
    { districtId: davlatobod.id, name: 'Yangiobod MFY', threshold: 500 },
  ];

  const mfyIds: number[] = [];
  for (const item of seedMfys) {
    const norm = normalizeGeographyName(item.name);
    const [m] = await db
      .insert(mfys)
      .values({
        districtId: item.districtId,
        name: item.name,
        normalizedName: norm,
        status: 'approved',
        workloadThresholdLiters: item.threshold,
      })
      .onConflictDoNothing()
      .returning({ id: mfys.id });
    if (m) {
      mfyIds.push(m.id);
    } else {
      const [existing] = await db
        .select({ id: mfys.id })
        .from(mfys)
        .where(sql`${mfys.districtId} = ${item.districtId} AND ${mfys.normalizedName} = ${norm}`)
        .limit(1);
      if (existing) mfyIds.push(existing.id);
    }
  }

  // 3. Seed 100 levels (only if empty)
  const existingLevels = await db.select({ count: sql<number>`count(*)::int` }).from(levels);
  if ((existingLevels[0]?.count ?? 0) < 100) {
    const levelBatch = Array.from({ length: 100 }, (_, i) => {
      const n = i + 1;
      return {
        level: n,
        title: getLevelTitle(n),
        minXp: getLevelThreshold(n),
      };
    });
    await db.insert(levels).values(levelBatch).onConflictDoNothing();
  }

  // 4. Seed configurable reward rules
  const defaultRules = [
    { code: 'verified_qr_pickup', title: 'Tasdiqlangan QR yig‘imi', xpAmount: 25, coinAmount: 5 },
    { code: 'daily_quiz', title: 'Kundalik ekologik viktorina', xpAmount: 10, coinAmount: 2 },
    { code: 'approved_report', title: 'Tasdiqlangan foydali murojaat', xpAmount: 15, coinAmount: 3 },
    { code: 'participation', title: 'Tasdiqlangan ekologik faollik', xpAmount: 10, coinAmount: 2 },
    { code: 'streak_7', title: '7 kunlik seriya bonusi', xpAmount: 20, coinAmount: 5 },
    { code: 'streak_30', title: '30 kunlik seriya bonusi', xpAmount: 100, coinAmount: 20 },
  ];
  for (const rule of defaultRules) {
    await db.insert(rewardRules).values(rule).onConflictDoNothing();
  }

  // 5. Seed system settings (volume range scheduling estimates)
  await db
    .insert(systemSettings)
    .values({
      key: 'volume_estimates',
      valueJson: JSON.stringify(DEFAULT_VOLUME_ESTIMATES),
    })
    .onConflictDoNothing();

  // 6. Seed base non-quiz quests + 100 default daily quiz questions idempotently
  const existingQuestCodesRows = await db
    .select({ templateCode: quests.templateCode })
    .from(quests);
  const existingQuestCodes = new Set(existingQuestCodesRows.map((q) => q.templateCode));

  const baseActionQuests = [
    {
      templateCode: 'toza_mahalla',
      title: 'Toza Mahalla',
      description: 'Mahallangizda saralangan chiqindini suratga olib murojaat yuboring va tasdiqlating.',
      questType: 'report',
      xpReward: 15,
      coinReward: 3,
      questionText: null,
      optionsJson: null,
      correctOptionIndex: null,
      isActive: true,
    },
    {
      templateCode: 'yashil_qadam',
      title: 'Yashil Qadam',
      description: 'Bugungi ekologik odatni tanlang va faolligingizni tasdiqlang.',
      questType: 'participation',
      xpReward: 10,
      coinReward: 2,
      questionText: 'Qayta ishlanadigan qog‘oz chiqindilari qaysi resursni eng ko‘p tejaydi?',
      optionsJson: JSON.stringify([
        'Daraxtlar va chuchuk suvni',
        'Faqat metall rudalarini',
        'Neft quduqlarini',
        'Hech qanday resursni tejamaydi',
      ]),
      correctOptionIndex: 0,
      isActive: true,
    },
  ];

  const missingBaseQuests = baseActionQuests.filter((q) => !existingQuestCodes.has(q.templateCode));
  if (missingBaseQuests.length > 0) {
    await db.insert(quests).values(missingBaseQuests);
  }

  const missingDailyQuizzes = DAILY_QUIZ_BANK.filter(
    (q) => !existingQuestCodes.has(q.templateCode)
  ).map((q) => ({
    templateCode: q.templateCode,
    title: q.title,
    description: q.description,
    questType: 'quiz',
    xpReward: 10,
    coinReward: 2,
    questionText: q.questionText,
    optionsJson: JSON.stringify(q.options),
    correctOptionIndex: q.correctOptionIndex,
    isActive: true,
  }));

  if (missingDailyQuizzes.length > 0) {
    await db.insert(quests).values(missingDailyQuizzes);
  }

  // Deactivate legacy 2 sample quizzes so only the 100-question daily bank rotates 1/day
  await db
    .update(quests)
    .set({ isActive: false })
    .where(inArray(quests.templateCode, ['eco_bilim', 'saralash_ustasi']));

  // 7. Seed Eco Facts (if none exist)
  const existingFacts = await db.select({ count: sql<number>`count(*)::int` }).from(ecoFacts);
  if ((existingFacts[0]?.count ?? 0) === 0) {
    await db.insert(ecoFacts).values([
      {
        title: '1 tonna qog‘oz — 17 ta daraxt',
        content: 'Bir tonna makulaturani qayta ishlash o‘rtacha 17 ta katta daraxtni, 26 000 litr suvni va 4 000 kVt·soat elektr energiyasini tejaydi.',
        category: 'Qog‘oz',
        isActive: true,
      },
      {
        title: 'Alyuminiy cheksiz qayta ishlanadi',
        content: 'Metall va alyuminiy bankalarni sifatini yo‘qotmasdan cheksiz marta qayta ishlash mumkin. Bu yangi ishlab chiqarishga nisbatan 95% energiya tejaydi.',
        category: 'Metall',
        isActive: true,
      },
      {
        title: 'Shisha 100% qayta tiklanadi',
        content: 'Saralangan shisha idishlar to‘liq qayta eritilib yangi idishlarga aylantiriladi va poligonlardagi yuklamani sezilarli kamaytiradi.',
        category: 'Shisha',
        isActive: true,
      },
      {
        title: 'Organik chiqindidan tabiiy o‘g‘it',
        content: 'Uy xo‘jaligidagi oziq-ovqat va bog‘ chiqindilarini kompost qilish tuproq unumdorligini oshiradi hamda metan gazini kamaytiradi.',
        category: 'Organik',
        isActive: true,
      },
    ]);
  }

  // 8. Seed Eco Market Rewards (using generated local studio product photos)
  const existingRewards = await db.select({ count: sql<number>`count(*)::int` }).from(marketRewards);
  if ((existingRewards[0]?.count ?? 0) === 0) {
    await db.insert(marketRewards).values([
      {
        title: 'YASHNAR Eko Sumka',
        description: 'Tabiiy paxtadan tayyorlangan ko‘p martalik mustahkam xarid sumkasi. Plastik paketlardan voz kechish uchun qulay.',
        imageUrl: '/src/assets/images/reward_eco_bag_1795168858843.jpg',
        coinCost: 15,
        stockQuantity: 40,
        fulfillmentConditions: 'Namangan shahri YASHNAR ekologiya markazidan 5 ish kuni ichida shaxsiy ID bilan olib ketiladi.',
        isActive: true,
      },
      {
        title: 'Zumrad Termo Idish (750 ml)',
        description: 'Zanglamaydigan po‘latdan ishlangan ko‘p martalik termo suv idishi. Ichimlik haroratini 12 soat saqlaydi.',
        imageUrl: '/src/assets/images/reward_thermo_bottle_1795168860286.jpg',
        coinCost: 35,
        stockQuantity: 25,
        fulfillmentConditions: 'Tuman MFY markazi orqali 7 ish kuni ichida yetkazib beriladi.',
        isActive: true,
      },
      {
        title: 'Mevali Daraxt Ko‘chati',
        description: 'Mahallangiz yoki hovlingizga ekish uchun parvarishlangan yosh daraxt ko‘chati (sopol tuvakda).',
        imageUrl: '/src/assets/images/reward_tree_sapling_1795168857854.jpg',
        coinCost: 10,
        stockQuantity: 60,
        fulfillmentConditions: 'Namangan ko‘chatxonasidan yoki mahalla ekologik aksiyasida topshiriladi.',
        isActive: true,
      },
      {
        title: 'Oshxona Kompost Idishi',
        description: 'Bambuk qopqoqli ixcham uy kompost idishi. Organik chiqindilarni hidsiz va tartibli yig‘ish uchun.',
        imageUrl: '/src/assets/images/reward_compost_bin_1795168876763.jpg',
        coinCost: 50,
        stockQuantity: 15,
        fulfillmentConditions: 'YASHNAR hamkor punktidan 5 ish kuni ichida topshiriladi.',
        isActive: true,
      },
    ]);
  }

  // 9. Seed Reference Staff Accounts (Admin & Approved Driver) if not present
  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'admin@yashnar.uz'))
    .limit(1);

  let adminId = existingAdmin[0]?.id;
  if (!adminId) {
    const adminPass = await hashPassword('AdminYashnar2026!');
    const [createdAdmin] = await db
      .insert(users)
      .values({
        uid: 'local:seed-admin-yashnar',
        email: 'admin@yashnar.uz',
        passwordHash: adminPass,
        fullName: 'Sardorbek Rahimov',
        phone: '+998901000001',
        role: 'admin',
        accountStatus: 'active',
        regionId: region.id,
        districtId: namanganCity.id,
        mfyId: mfyIds[0] ?? null,
        publicLeaderboardName: 'Sardorbek R.',
        leaderboardVisible: false,
        onboardingCompleted: true,
      })
      .returning({ id: users.id });
    adminId = createdAdmin.id;
    await db.insert(wallets).values({ userId: adminId }).onConflictDoNothing();
  }

  const existingDriverUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'driver@yashnar.uz'))
    .limit(1);

  if (!existingDriverUser[0]) {
    const driverPass = await hashPassword('DriverYashnar2026!');
    const [createdDriverUser] = await db
      .insert(users)
      .values({
        uid: 'local:seed-driver-yashnar',
        email: 'driver@yashnar.uz',
        passwordHash: driverPass,
        fullName: 'Dilshodjon Karimov',
        phone: '+998901000002',
        role: 'driver',
        accountStatus: 'active',
        regionId: region.id,
        districtId: namanganCity.id,
        mfyId: mfyIds[0] ?? null,
        publicLeaderboardName: 'Dilshodjon K.',
        leaderboardVisible: false,
        onboardingCompleted: true,
      })
      .returning({ id: users.id });

    await db.insert(wallets).values({ userId: createdDriverUser.id }).onConflictDoNothing();

    const [driverRow] = await db
      .insert(drivers)
      .values({
        userId: createdDriverUser.id,
        approvalStatus: 'approved',
        vehiclePlate: '50 A 742 EA',
        vehicleCapacityLiters: 4000,
        approvedBy: adminId,
        approvedAt: new Date(),
      })
      .returning({ id: drivers.id });

    // Assign driver to first 3 Namangan MFYs
    for (const mfyId of mfyIds.slice(0, 3)) {
      await db
        .insert(driverAssignments)
        .values({
          driverId: driverRow.id,
          mfyId,
          assignedBy: adminId,
          isActive: true,
        })
        .onConflictDoNothing();
    }
  }
}
