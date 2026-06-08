CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "public"."member_roles_enum" AS ENUM('OWNER', 'ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."message_types_enum" AS ENUM('TEXT', 'SYSTEM');--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"type" "chat_room_types_enum" DEFAULT 'GROUP' NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_members" integer DEFAULT 100 NOT NULL,
	"created_by" bigint NOT NULL,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_room_members" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_room_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"chat_room_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"role" "member_roles_enum" DEFAULT 'MEMBER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_read_seq" bigint DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_room_members_chat_room_id_user_id_unique" UNIQUE("chat_room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"chat_room_id" bigint NOT NULL,
	"sender_id" bigint NOT NULL,
	"type" "message_types_enum" DEFAULT 'TEXT' NOT NULL,
	"content" text,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"sequence_number" bigint NOT NULL,
	"edited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_message_room_sequence" UNIQUE("chat_room_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text NOT NULL,
	"profile_image_url" text,
	"status" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_room_created_by" ON "chat_rooms" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_chat_room_type" ON "chat_rooms" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_chat_room_active" ON "chat_rooms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_chat_room_updated_cursor" ON "chat_rooms" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "idx_chat_room_name_tgram" ON "chat_rooms" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_room_member_user_id" ON "chat_room_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_room_member_chat_room_id" ON "chat_room_members" USING btree ("chat_room_id");--> statement-breakpoint
CREATE INDEX "idx_chat_room_member_active" ON "chat_room_members" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_chat_room_member_role" ON "chat_room_members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_message_chat_room_id" ON "messages" USING btree ("chat_room_id");--> statement-breakpoint
CREATE INDEX "idx_message_sender_id" ON "messages" USING btree ("sender_id");