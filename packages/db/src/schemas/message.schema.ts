import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { chatRooms, SelectChatRoom } from "./chat-room.schema";
import { createdAt, id } from "./columns";
import { SelectUser, users } from "./user.schema";

export const messageTypesEnum = pgEnum("message_types_enum", [
	"TEXT",
	"SYSTEM",
]);

export type MessageType = (typeof messageTypesEnum.enumValues)[number];

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
		sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
		editedAt: timestamp("edited_at"),
		...createdAt,
	},
	(t) => [
		unique("uq_message_room_sequence").on(t.chatRoomId, t.sequenceNumber),
		index("idx_message_chat_room_id").on(t.chatRoomId),
		index("idx_message_sender_id").on(t.senderId),
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
export type MessageWithSenderRelations = SelectMessage & {
	sender: SelectUser;
};
export type MessageWithAllRelations = SelectMessage & {
	chatRoom: SelectChatRoom;
	sender: SelectUser;
};
