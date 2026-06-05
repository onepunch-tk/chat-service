import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { chatRooms } from "./chat-room.schema";
import { chatRoomMembers } from "./chat-room-member.schema";
import { id, timestamps } from "./columns";
import { messages } from "./message.schema";

export const users = pgTable("users", {
	...id,
	username: text().notNull().unique(),
	password: text().notNull(),
	displayName: text("display_name").notNull(),
	profileImageUrl: text("profile_image_url"),
	status: text(),
	isActive: boolean("is_active").notNull().default(true),
	lastSeenAt: timestamp("last_seen_at"),
	...timestamps,
});

export const usersRelations = relations(users, ({ many }) => ({
	createdRooms: many(chatRooms),
	memberships: many(chatRoomMembers),
	messages: many(messages),
}));

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
