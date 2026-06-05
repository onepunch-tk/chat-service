import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { chatRooms } from "./chat-room.schema";
import { createdAt, id } from "./columns";
import { users } from "./user.schema";

export const messageTypesEnum = pgEnum("message_types_enum", [
	"TEXT",
	"SYSTEM",
]);

export const messages = pgTable(
	"messages",
	{
		...id,
		chatRoomId: bigint("chat_room_id", { mode: "number" })
			.notNull()
			.references(() => chatRooms.id),
		senderId: bigint("sender_id", { mode: "number" })
			.notNull()
			.references(() => users.id),
		type: messageTypesEnum().notNull().default("TEXT"),
		content: text(),
		isEdited: boolean("is_edited").notNull().default(false),
		isDeleted: boolean("is_deleted").notNull().default(false),
		sequenceNumber: bigint("sequence_number", { mode: "number" })
			.notNull()
			.default(0),
		editedAt: timestamp("edited_at"),
		...createdAt,
	},
	(t) => [
		index("idx_message_chat_room_id").on(t.chatRoomId),
		index("idx_message_sender_id").on(t.senderId),
		index("idx_message_created_at").on(t.createdAt),
		index("idx_message_room_time").on(t.chatRoomId, t.createdAt),
		index("idx_message_room_sequence").on(t.chatRoomId, t.sequenceNumber),
	],
);

export const messagesRelations = relations(messages, ({ one }) => ({
	chatRoom: one(chatRooms, {
		fields: [messages.chatRoomId],
		references: [chatRooms.id],
	}),
	sender: one(users, {
		fields: [messages.senderId],
		references: [users.id],
	}),
}));

export type InsertMessage = typeof messages.$inferInsert;
export type SelectMessage = typeof messages.$inferSelect;
