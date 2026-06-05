import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import { chatRoomMembers } from "./chat-room-member.schema";
import { id, timestamps } from "./columns";
import { messages } from "./message.schema";
import { users } from "./user.schema";

export const chatRoomTypesEnum = pgEnum("chat_room_types_enum", [
	"DIRECT",
	"GROUP",
	"CHANNEL",
]);

export const chatRooms = pgTable(
	"chat_rooms",
	{
		...id,
		name: text().notNull(),
		description: text(),
		type: chatRoomTypesEnum().notNull().default("GROUP"),
		imageUrl: text("image_url"),
		isActive: boolean("is_active").notNull().default(true),
		maxMembers: integer("max_members").notNull().default(100),
		createdBy: bigint("created_by", { mode: "number" })
			.notNull()
			.references(() => users.id),
		...timestamps,
	},
	(t) => [
		index("idx_chat_room_created_by").on(t.createdBy),
		index("idx_chat_room_type").on(t.type),
		index("idx_chat_room_active").on(t.isActive),
	],
);

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
	creator: one(users, {
		fields: [chatRooms.createdBy],
		references: [users.id],
	}),
	members: many(chatRoomMembers),
	messages: many(messages),
}));

export type InsertChatRoom = typeof chatRooms.$inferInsert;
export type SelectChatRoom = typeof chatRooms.$inferSelect;
