import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. GEOGRAPHY
export const regions = pgTable('regions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const districts = pgTable(
  'districts',
  {
    id: serial('id').primaryKey(),
    regionId: integer('region_id')
      .references(() => regions.id, { onDelete: 'restrict' })
      .notNull(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('districts_region_norm_uidx').on(t.regionId, t.normalizedName),
    index('districts_region_idx').on(t.regionId),
  ]
);

export const mfys = pgTable(
  'mfys',
  {
    id: serial('id').primaryKey(),
    districtId: integer('district_id')
      .references(() => districts.id, { onDelete: 'restrict' })
      .notNull(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    status: text('status').default('approved').notNull(), // 'approved' | 'pending' | 'merged'
    mergedIntoId: integer('merged_into_id'),
    workloadThresholdLiters: integer('workload_threshold_liters').default(500).notNull(),
    createdByUserId: integer('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('mfys_district_norm_uidx').on(t.districtId, t.normalizedName),
    index('mfys_district_idx').on(t.districtId),
    check('mfys_threshold_positive', sql`${t.workloadThresholdLiters} > 0`),
    check('mfys_status_check', sql`${t.status} in ('approved', 'pending', 'merged')`),
  ]
);

// 2. PROFILES & SESSIONS
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    phone: text('phone').default('').notNull(),
    role: text('role').default('citizen').notNull(), // 'citizen' | 'driver' | 'admin'
    accountStatus: text('account_status').default('active').notNull(), // 'active' | 'suspended'
    regionId: integer('region_id').references(() => regions.id),
    districtId: integer('district_id').references(() => districts.id),
    mfyId: integer('mfy_id').references(() => mfys.id),
    publicLeaderboardName: text('public_leaderboard_name'),
    leaderboardVisible: boolean('leaderboard_visible').default(true).notNull(),
    onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
    themePreference: text('theme_preference').default('light').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    index('users_district_mfy_idx').on(t.districtId, t.mfyId),
    check('users_role_check', sql`${t.role} in ('citizen', 'driver', 'admin')`),
    check('users_status_check', sql`${t.accountStatus} in ('active', 'suspended')`),
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

// 3. DRIVERS & ASSIGNMENTS
export const drivers = pgTable(
  'drivers',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    approvalStatus: text('approval_status').default('pending').notNull(), // 'pending' | 'approved' | 'suspended'
    vehiclePlate: text('vehicle_plate').default('').notNull(),
    vehicleCapacityLiters: integer('vehicle_capacity_liters').default(4000).notNull(),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'drivers_approval_check',
      sql`${t.approvalStatus} in ('pending', 'approved', 'suspended')`
    ),
    check('drivers_capacity_positive', sql`${t.vehicleCapacityLiters} > 0`),
  ]
);

export const driverAssignments = pgTable(
  'driver_assignments',
  {
    id: serial('id').primaryKey(),
    driverId: integer('driver_id')
      .references(() => drivers.id, { onDelete: 'cascade' })
      .notNull(),
    mfyId: integer('mfy_id')
      .references(() => mfys.id, { onDelete: 'cascade' })
      .notNull(),
    assignedBy: integer('assigned_by').references(() => users.id),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('driver_assignments_driver_mfy_uidx').on(t.driverId, t.mfyId),
    index('driver_assignments_mfy_idx').on(t.mfyId),
  ]
);

// 4. TRIPS & LOCATIONS
export const driverTrips = pgTable(
  'driver_trips',
  {
    id: serial('id').primaryKey(),
    driverId: integer('driver_id')
      .references(() => drivers.id, { onDelete: 'cascade' })
      .notNull(),
    mfyId: integer('mfy_id')
      .references(() => mfys.id, { onDelete: 'restrict' })
      .notNull(),
    status: text('status').default('active').notNull(), // 'active' | 'completed' | 'cancelled'
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    totalCollectedLiters: doublePrecision('total_collected_liters').default(0).notNull(),
  },
  (t) => [
    index('driver_trips_driver_status_idx').on(t.driverId, t.status),
    index('driver_trips_mfy_status_idx').on(t.mfyId, t.status),
    check('driver_trips_status_check', sql`${t.status} in ('active', 'completed', 'cancelled')`),
  ]
);

export const driverLocations = pgTable(
  'driver_locations',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id')
      .references(() => driverTrips.id, { onDelete: 'cascade' })
      .notNull(),
    driverId: integer('driver_id')
      .references(() => drivers.id, { onDelete: 'cascade' })
      .notNull(),
    mfyId: integer('mfy_id')
      .references(() => mfys.id, { onDelete: 'cascade' })
      .notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracyMeters: doublePrecision('accuracy_meters').default(20).notNull(),
    heading: doublePrecision('heading'),
    speedMps: doublePrecision('speed_mps'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('driver_locations_trip_uidx').on(t.tripId),
    index('driver_locations_mfy_idx').on(t.mfyId),
  ]
);

// 5. REPORTS, PICKUPS, STATUS EVENTS & DISPUTES
export const wasteReports = pgTable(
  'waste_reports',
  {
    id: serial('id').primaryKey(),
    publicCode: text('public_code').notNull().unique(),
    citizenId: integer('citizen_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    districtId: integer('district_id')
      .references(() => districts.id, { onDelete: 'restrict' })
      .notNull(),
    mfyId: integer('mfy_id')
      .references(() => mfys.id, { onDelete: 'restrict' })
      .notNull(),
    category: text('category').notNull(),
    estimatedRange: text('estimated_range').notNull(),
    estimatedLiters: integer('estimated_liters').notNull(),
    actualLiters: doublePrecision('actual_liters'),
    description: text('description').default('').notNull(),
    address: text('address').default('').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    photoStorageKey: text('photo_storage_key'),
    status: text('status').default('submitted').notNull(),
    assignedDriverId: integer('assigned_driver_id').references(() => drivers.id),
    tripId: integer('trip_id').references(() => driverTrips.id),
    approvedForReward: boolean('approved_for_reward').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('waste_reports_citizen_idx').on(t.citizenId, t.createdAt),
    index('waste_reports_mfy_status_idx').on(t.mfyId, t.status),
    check('waste_reports_est_positive', sql`${t.estimatedLiters} > 0`),
    check(
      'waste_reports_actual_valid',
      sql`${t.actualLiters} is null or (${t.actualLiters} > 0 and ${t.actualLiters} <= 100000)`
    ),
    check(
      'waste_reports_status_check',
      sql`${t.status} in ('submitted', 'reviewing', 'assigned', 'en_route', 'arrived', 'completed', 'cancelled')`
    ),
  ]
);

export const reportStatusEvents = pgTable(
  'report_status_events',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id')
      .references(() => wasteReports.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull(),
    actorUserId: integer('actor_user_id').references(() => users.id),
    note: text('note').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('report_status_events_report_idx').on(t.reportId, t.createdAt)]
);

export const disputes = pgTable(
  'disputes',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id')
      .references(() => wasteReports.id, { onDelete: 'cascade' })
      .notNull(),
    citizenId: integer('citizen_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reason: text('reason').notNull(),
    status: text('status').default('open').notNull(),
    resolutionNote: text('resolution_note').default('').notNull(),
    resolvedBy: integer('resolved_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('disputes_report_idx').on(t.reportId),
    check('disputes_status_check', sql`${t.status} in ('open', 'reviewing', 'resolved', 'rejected')`),
  ]
);

// 6. QR CREDENTIALS & SCAN EVENTS
export const qrCredentials = pgTable(
  'qr_credentials',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenDigest: text('token_digest').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('qr_credentials_user_idx').on(t.userId, t.expiresAt)]
);

export const qrScanEvents = pgTable(
  'qr_scan_events',
  {
    id: serial('id').primaryKey(),
    credentialId: integer('credential_id')
      .references(() => qrCredentials.id, { onDelete: 'restrict' })
      .notNull(),
    driverId: integer('driver_id')
      .references(() => drivers.id, { onDelete: 'restrict' })
      .notNull(),
    tripId: integer('trip_id')
      .references(() => driverTrips.id, { onDelete: 'restrict' })
      .notNull(),
    citizenId: integer('citizen_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    reportId: integer('report_id').references(() => wasteReports.id, { onDelete: 'restrict' }),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    actualLiters: doublePrecision('actual_liters'),
    status: text('status').default('scanned').notNull(), // 'scanned' | 'confirmed'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('qr_scan_events_trip_idx').on(t.tripId),
    check('qr_scan_status_check', sql`${t.status} in ('scanned', 'confirmed')`),
  ]
);

// 7. GAMIFICATION, LEDGERS, WALLETS, LEVELS, QUESTS
export const rewardRules = pgTable('reward_rules', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  xpAmount: integer('xp_amount').notNull(),
  coinAmount: integer('coin_amount').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wallets = pgTable(
  'wallets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    coinBalance: integer('coin_balance').default(0).notNull(),
    totalXp: integer('total_xp').default(0).notNull(),
    currentLevel: integer('current_level').default(1).notNull(),
    currentStreak: integer('current_streak').default(0).notNull(),
    longestStreak: integer('longest_streak').default(0).notNull(),
    lastActiveDate: text('last_active_date'), // YYYY-MM-DD in Asia/Tashkent
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('wallets_coin_non_negative', sql`${t.coinBalance} >= 0`),
    check('wallets_xp_non_negative', sql`${t.totalXp} >= 0`),
  ]
);

export const xpLedger = pgTable(
  'xp_ledger',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    eventKey: text('event_key').notNull().unique(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id'),
    xpAmount: integer('xp_amount').notNull(),
    localDateTashkent: text('local_date_tashkent').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('xp_ledger_user_date_idx').on(t.userId, t.localDateTashkent)]
);

export const coinLedger = pgTable(
  'coin_ledger',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    eventKey: text('event_key').notNull().unique(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id'),
    coinAmount: integer('coin_amount').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('coin_ledger_user_idx').on(t.userId, t.createdAt)]
);

export const levels = pgTable('levels', {
  level: integer('level').primaryKey(),
  title: text('title').notNull(),
  minXp: integer('min_xp').notNull(),
});

export const quests = pgTable('quests', {
  id: serial('id').primaryKey(),
  templateCode: text('template_code').notNull(), // 'eco_bilim' | 'toza_mahalla' | 'saralash_ustasi' | 'yashil_qadam'
  title: text('title').notNull(),
  description: text('description').notNull(),
  questType: text('quest_type').default('quiz').notNull(), // 'quiz' | 'pickup' | 'report' | 'participation'
  xpReward: integer('xp_reward').default(10).notNull(),
  coinReward: integer('coin_reward').default(2).notNull(),
  questionText: text('question_text'),
  optionsJson: text('options_json'), // JSON string[]
  correctOptionIndex: integer('correct_option_index'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const questSubmissions = pgTable(
  'quest_submissions',
  {
    id: serial('id').primaryKey(),
    questId: integer('quest_id')
      .references(() => quests.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    localDateTashkent: text('local_date_tashkent').notNull(),
    selectedOptionIndex: integer('selected_option_index'),
    isCorrect: boolean('is_correct').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('quest_submissions_user_date_idx').on(t.userId, t.localDateTashkent)]
);

export const questCompletions = pgTable(
  'quest_completions',
  {
    id: serial('id').primaryKey(),
    questId: integer('quest_id')
      .references(() => quests.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    localDateTashkent: text('local_date_tashkent').notNull(),
    eventKey: text('event_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('quest_completions_user_quest_date_uidx').on(t.userId, t.questId, t.localDateTashkent)]
);

export const achievements = pgTable(
  'achievements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    localDateTashkent: text('local_date_tashkent').notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('achievements_user_code_date_uidx').on(t.userId, t.code, t.localDateTashkent)]
);

// 8. ECO MARKET & REDEMPTIONS
export const marketRewards = pgTable(
  'market_rewards',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    imageUrl: text('image_url').notNull(),
    coinCost: integer('coin_cost').notNull(),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    fulfillmentConditions: text('fulfillment_conditions').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('market_rewards_cost_positive', sql`${t.coinCost} > 0`),
    check('market_rewards_stock_non_negative', sql`${t.stockQuantity} >= 0`),
  ]
);

export const redemptions = pgTable(
  'redemptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    rewardId: integer('reward_id')
      .references(() => marketRewards.id, { onDelete: 'restrict' })
      .notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    coinCostSnapshot: integer('coin_cost_snapshot').notNull(),
    status: text('status').default('pending').notNull(), // 'pending' | 'fulfilled' | 'refunded' | 'cancelled'
    fulfillmentNote: text('fulfillment_note').default('').notNull(),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('redemptions_user_idx').on(t.userId, t.createdAt),
    check('redemptions_status_check', sql`${t.status} in ('pending', 'fulfilled', 'refunded', 'cancelled')`),
  ]
);

export const inventoryEvents = pgTable(
  'inventory_events',
  {
    id: serial('id').primaryKey(),
    rewardId: integer('reward_id')
      .references(() => marketRewards.id, { onDelete: 'cascade' })
      .notNull(),
    redemptionId: integer('redemption_id').references(() => redemptions.id),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    actorUserId: integer('actor_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('inventory_events_reward_idx').on(t.rewardId)]
);

// 9. NOTIFICATIONS, PUSH, ECO FACTS, AUDIT LOGS, SETTINGS
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: text('related_entity_id'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.isRead, t.createdAt)]
);

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: serial('id').primaryKey(),
  notificationId: integer('notification_id')
    .references(() => notifications.id, { onDelete: 'cascade' })
    .notNull(),
  channel: text('channel').notNull(), // 'in_app' | 'websocket' | 'push'
  status: text('status').notNull(), // 'delivered' | 'failed'
  deliveredAt: timestamp('delivered_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ecoFacts = pgTable('eco_facts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').default('Ekologiya').notNull(),
  publishDate: text('publish_date'), // YYYY-MM-DD optional
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadataJson: text('metadata_json').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt)]
);

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// RELATIONS
export const regionsRelations = relations(regions, ({ many }) => ({
  districts: many(districts),
}));

export const districtsRelations = relations(districts, ({ one, many }) => ({
  region: one(regions, { fields: [districts.regionId], references: [regions.id] }),
  mfys: many(mfys),
}));

export const mfysRelations = relations(mfys, ({ one }) => ({
  district: one(districts, { fields: [mfys.districtId], references: [districts.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  region: one(regions, { fields: [users.regionId], references: [regions.id] }),
  district: one(districts, { fields: [users.districtId], references: [districts.id] }),
  mfy: one(mfys, { fields: [users.mfyId], references: [mfys.id] }),
  wallet: one(wallets, { fields: [users.id], references: [wallets.userId] }),
}));
