CREATE SEQUENCE "public"."sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "anchors" (
	"user_id" text NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "anchors_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"user_id" text NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	"habit_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"status" text NOT NULL,
	"skip_reason" text,
	"note" text,
	"value" double precision,
	CONSTRAINT "check_ins_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"user_id" text NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mode" text NOT NULL,
	"weekly_quota" smallint,
	"weekdays" smallint[] NOT NULL,
	"starts_on" date NOT NULL,
	"anchor_id" uuid NOT NULL,
	"color" text NOT NULL,
	"icon" text,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "habits_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	"time_zone" text NOT NULL,
	"day_cutoff_hour" smallint NOT NULL,
	"style" text NOT NULL,
	CONSTRAINT "user_settings_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "weekly_quota_overrides" (
	"user_id" text NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	"habit_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"quota" smallint NOT NULL,
	CONSTRAINT "weekly_quota_overrides_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"user_id" text NOT NULL,
	"id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint NOT NULL,
	"week_start" date NOT NULL,
	"reflection" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "weekly_reviews_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE INDEX "anchors_user_id_server_seq_idx" ON "anchors" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "check_ins_user_id_server_seq_idx" ON "check_ins" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "habits_user_id_server_seq_idx" ON "habits" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "user_settings_user_id_server_seq_idx" ON "user_settings" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "weekly_quota_overrides_user_id_server_seq_idx" ON "weekly_quota_overrides" USING btree ("user_id","server_seq");--> statement-breakpoint
CREATE INDEX "weekly_reviews_user_id_server_seq_idx" ON "weekly_reviews" USING btree ("user_id","server_seq");