import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	pgEnum,
	pgTable,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { chatRooms } from "./chat-room.schema";
import { createdAt, id } from "./columns";
import { users } from "./user.schema";

export const memberRolesEnum = pgEnum("member_roles_enum", [
	"OWNER",
	"ADMIN",
	"MEMBER",
]);

export const chatRoomMembers = pgTable(
	"chat_room_members",
	{
		...id,
		chatRoomId: bigint("chat_room_id", { mode: "number" })
			.notNull()
			.references(() => chatRooms.id),
		userId: bigint("user_id", { mode: "number" })
			.notNull()
			.references(() => users.id),
		role: memberRolesEnum().notNull().default("MEMBER"),
		isActive: boolean("is_active").notNull().default(true),
		lastReadSeq: bigint("last_read_seq", { mode: "number" })
			.notNull()
			.default(0),
		joinedAt: timestamp("joined_at").notNull().defaultNow(),
		leftAt: timestamp("left_at"),
		...createdAt,
	},
	(t) => [
		unique().on(t.chatRoomId, t.userId),
		index("idx_chat_room_member_user_id").on(t.userId),
		index("idx_chat_room_member_chat_room_id").on(t.chatRoomId),
		index("idx_chat_room_member_active").on(t.isActive),
		index("idx_chat_room_member_role").on(t.role),
	],
);

export const chatRoomMembersRelations = relations(
	chatRoomMembers,
	({ one }) => ({
		chatRoom: one(chatRooms, {
			fields: [chatRoomMembers.chatRoomId],
			references: [chatRooms.id],
		}),
		user: one(users, {
			fields: [chatRoomMembers.userId],
			references: [users.id],
		}),
	}),
);

export type InsertChatRoomMembers = typeof chatRoomMembers.$inferInsert;
export type SelectChatRoomMembers = typeof chatRoomMembers.$inferSelect;
