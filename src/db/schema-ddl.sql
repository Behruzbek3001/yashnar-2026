CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"local_date_tashkent" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "coin_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_key" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"coin_amount" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_ledger_event_key_unique" UNIQUE("event_key")
);

CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"citizen_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_note" text DEFAULT '' NOT NULL,
	"resolved_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_status_check" CHECK ("disputes"."status" in ('open', 'reviewing', 'resolved', 'rejected'))
);

CREATE TABLE "districts" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "driver_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"mfy_id" integer NOT NULL,
	"assigned_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "driver_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"mfy_id" integer NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" double precision DEFAULT 20 NOT NULL,
	"heading" double precision,
	"speed_mps" double precision,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "driver_trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"mfy_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"total_collected_liters" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "driver_trips_status_check" CHECK ("driver_trips"."status" in ('active', 'completed', 'cancelled'))
);

CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"vehicle_plate" text DEFAULT '' NOT NULL,
	"vehicle_capacity_liters" integer DEFAULT 4000 NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "drivers_approval_check" CHECK ("drivers"."approval_status" in ('pending', 'approved', 'suspended')),
	CONSTRAINT "drivers_capacity_positive" CHECK ("drivers"."vehicle_capacity_liters" > 0)
);

CREATE TABLE "eco_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'Ekologiya' NOT NULL,
	"publish_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "inventory_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"reward_id" integer NOT NULL,
	"redemption_id" integer,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "levels" (
	"level" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"min_xp" integer NOT NULL
);

CREATE TABLE "market_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text NOT NULL,
	"coin_cost" integer NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"fulfillment_conditions" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_rewards_cost_positive" CHECK ("market_rewards"."coin_cost" > 0),
	CONSTRAINT "market_rewards_stock_non_negative" CHECK ("market_rewards"."stock_quantity" >= 0)
);

CREATE TABLE "mfys" (
	"id" serial PRIMARY KEY NOT NULL,
	"district_id" integer NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"merged_into_id" integer,
	"workload_threshold_liters" integer DEFAULT 500 NOT NULL,
	"created_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mfys_threshold_positive" CHECK ("mfys"."workload_threshold_liters" > 0),
	CONSTRAINT "mfys_status_check" CHECK ("mfys"."status" in ('approved', 'pending', 'merged'))
);

CREATE TABLE "notification_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);

CREATE TABLE "qr_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_digest" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_credentials_token_digest_unique" UNIQUE("token_digest")
);

CREATE TABLE "qr_scan_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"credential_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"citizen_id" integer NOT NULL,
	"report_id" integer,
	"idempotency_key" text NOT NULL,
	"actual_liters" double precision,
	"status" text DEFAULT 'scanned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_scan_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "qr_scan_status_check" CHECK ("qr_scan_events"."status" in ('scanned', 'confirmed'))
);

CREATE TABLE "quest_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"local_date_tashkent" text NOT NULL,
	"event_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_completions_event_key_unique" UNIQUE("event_key")
);

CREATE TABLE "quest_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"local_date_tashkent" text NOT NULL,
	"selected_option_index" integer,
	"is_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quests" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"quest_type" text DEFAULT 'quiz' NOT NULL,
	"xp_reward" integer DEFAULT 10 NOT NULL,
	"coin_reward" integer DEFAULT 2 NOT NULL,
	"question_text" text,
	"options_json" text,
	"correct_option_index" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reward_id" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"coin_cost_snapshot" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"fulfillment_note" text DEFAULT '' NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemptions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "redemptions_status_check" CHECK ("redemptions"."status" in ('pending', 'fulfilled', 'refunded', 'cancelled'))
);

CREATE TABLE "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_name_unique" UNIQUE("name"),
	CONSTRAINT "regions_code_unique" UNIQUE("code")
);

CREATE TABLE "report_status_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"status" text NOT NULL,
	"actor_user_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reward_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"xp_amount" integer NOT NULL,
	"coin_amount" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_rules_code_unique" UNIQUE("code")
);

CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value_json" text NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"full_name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'citizen' NOT NULL,
	"account_status" text DEFAULT 'active' NOT NULL,
	"region_id" integer,
	"district_id" integer,
	"mfy_id" integer,
	"public_leaderboard_name" text,
	"leaderboard_visible" boolean DEFAULT true NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"theme_preference" text DEFAULT 'light' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('citizen', 'driver', 'admin')),
	CONSTRAINT "users_status_check" CHECK ("users"."account_status" in ('active', 'suspended'))
);

CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"coin_balance" integer DEFAULT 0 NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"current_level" integer DEFAULT 1 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_active_date" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wallets_coin_non_negative" CHECK ("wallets"."coin_balance" >= 0),
	CONSTRAINT "wallets_xp_non_negative" CHECK ("wallets"."total_xp" >= 0)
);

CREATE TABLE "waste_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_code" text NOT NULL,
	"citizen_id" integer NOT NULL,
	"district_id" integer NOT NULL,
	"mfy_id" integer NOT NULL,
	"category" text NOT NULL,
	"estimated_range" text NOT NULL,
	"estimated_liters" integer NOT NULL,
	"actual_liters" double precision,
	"description" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"photo_storage_key" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"assigned_driver_id" integer,
	"trip_id" integer,
	"approved_for_reward" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waste_reports_public_code_unique" UNIQUE("public_code"),
	CONSTRAINT "waste_reports_est_positive" CHECK ("waste_reports"."estimated_liters" > 0),
	CONSTRAINT "waste_reports_actual_valid" CHECK ("waste_reports"."actual_liters" is null or ("waste_reports"."actual_liters" > 0 and "waste_reports"."actual_liters" <= 100000)),
	CONSTRAINT "waste_reports_status_check" CHECK ("waste_reports"."status" in ('submitted', 'reviewing', 'assigned', 'en_route', 'arrived', 'completed', 'cancelled'))
);

CREATE TABLE "xp_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_key" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"xp_amount" integer NOT NULL,
	"local_date_tashkent" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_ledger_event_key_unique" UNIQUE("event_key")
);

ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "districts" ADD CONSTRAINT "districts_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_mfy_id_mfys_id_fk" FOREIGN KEY ("mfy_id") REFERENCES "public"."mfys"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_trip_id_driver_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."driver_trips"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_mfy_id_mfys_id_fk" FOREIGN KEY ("mfy_id") REFERENCES "public"."mfys"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "driver_trips" ADD CONSTRAINT "driver_trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "driver_trips" ADD CONSTRAINT "driver_trips_mfy_id_mfys_id_fk" FOREIGN KEY ("mfy_id") REFERENCES "public"."mfys"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_reward_id_market_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."market_rewards"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_redemption_id_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."redemptions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "mfys" ADD CONSTRAINT "mfys_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "qr_credentials" ADD CONSTRAINT "qr_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_credential_id_qr_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."qr_credentials"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_trip_id_driver_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."driver_trips"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_market_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."market_rewards"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "report_status_events" ADD CONSTRAINT "report_status_events_report_id_waste_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."waste_reports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "report_status_events" ADD CONSTRAINT "report_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reward_rules" ADD CONSTRAINT "reward_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_mfy_id_mfys_id_fk" FOREIGN KEY ("mfy_id") REFERENCES "public"."mfys"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_citizen_id_users_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_mfy_id_mfys_id_fk" FOREIGN KEY ("mfy_id") REFERENCES "public"."mfys"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_assigned_driver_id_drivers_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_trip_id_driver_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."driver_trips"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "achievements_user_code_date_uidx" ON "achievements" USING btree ("user_id","code","local_date_tashkent");
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");
CREATE INDEX "coin_ledger_user_idx" ON "coin_ledger" USING btree ("user_id","created_at");
CREATE INDEX "disputes_report_idx" ON "disputes" USING btree ("report_id");
CREATE UNIQUE INDEX "districts_region_norm_uidx" ON "districts" USING btree ("region_id","normalized_name");
CREATE INDEX "districts_region_idx" ON "districts" USING btree ("region_id");
CREATE UNIQUE INDEX "driver_assignments_driver_mfy_uidx" ON "driver_assignments" USING btree ("driver_id","mfy_id");
CREATE INDEX "driver_assignments_mfy_idx" ON "driver_assignments" USING btree ("mfy_id");
CREATE UNIQUE INDEX "driver_locations_trip_uidx" ON "driver_locations" USING btree ("trip_id");
CREATE INDEX "driver_locations_mfy_idx" ON "driver_locations" USING btree ("mfy_id");
CREATE INDEX "driver_trips_driver_status_idx" ON "driver_trips" USING btree ("driver_id","status");
CREATE INDEX "driver_trips_mfy_status_idx" ON "driver_trips" USING btree ("mfy_id","status");
CREATE INDEX "inventory_events_reward_idx" ON "inventory_events" USING btree ("reward_id");
CREATE UNIQUE INDEX "mfys_district_norm_uidx" ON "mfys" USING btree ("district_id","normalized_name");
CREATE INDEX "mfys_district_idx" ON "mfys" USING btree ("district_id");
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read","created_at");
CREATE INDEX "qr_credentials_user_idx" ON "qr_credentials" USING btree ("user_id","expires_at");
CREATE INDEX "qr_scan_events_trip_idx" ON "qr_scan_events" USING btree ("trip_id");
CREATE UNIQUE INDEX "quest_completions_user_quest_date_uidx" ON "quest_completions" USING btree ("user_id","quest_id","local_date_tashkent");
CREATE INDEX "quest_submissions_user_date_idx" ON "quest_submissions" USING btree ("user_id","local_date_tashkent");
CREATE INDEX "redemptions_user_idx" ON "redemptions" USING btree ("user_id","created_at");
CREATE INDEX "report_status_events_report_idx" ON "report_status_events" USING btree ("report_id","created_at");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX "users_district_mfy_idx" ON "users" USING btree ("district_id","mfy_id");
CREATE INDEX "waste_reports_citizen_idx" ON "waste_reports" USING btree ("citizen_id","created_at");
CREATE INDEX "waste_reports_mfy_status_idx" ON "waste_reports" USING btree ("mfy_id","status");
CREATE INDEX "xp_ledger_user_date_idx" ON "xp_ledger" USING btree ("user_id","local_date_tashkent");
