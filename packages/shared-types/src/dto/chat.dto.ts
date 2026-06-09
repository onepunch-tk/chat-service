import type {
	ChatRoomType,
	InsertChatRoom,
	InsertChatRoomMembers,
	InsertMessage,
	MemberRolesType,
	MessageType,
	SelectChatRoom,
	SelectChatRoomMembers,
	SelectMessage,
} from "@repo/db/schemas";
import * as z from "zod";
import type { Serialized } from "./serialized";
import type { UserDto } from "./user.dto";

// 값 리스트는 런타임 검증용 — satisfies가 DB enum 타입에 없는 값을 선언 즉시 막는다.
export const CHAT_ROOM_TYPES = [
	"DIRECT",
	"GROUP",
	"CHANNEL",
] as const satisfies readonly ChatRoomType[];

export const MESSAGE_TYPES = [
	"TEXT",
	"SYSTEM",
] as const satisfies readonly MessageType[];

export const MEMBER_ROLES = [
	"OWNER",
	"ADMIN",
	"MEMBER",
] as const satisfies readonly MemberRolesType[];

export const createChatRoomSchema = z.object({
	name: z
		.string({ error: "채팅방 이름은 필수입니다." })
		.trim()
		.min(1, { error: "채팅방 이름은 1-100자 사이여야 합니다." })
		.max(100, { error: "채팅방 이름은 1-100자 사이여야 합니다." }),
	description: z.string().nullish(),
	type: z.enum(CHAT_ROOM_TYPES, {
		error: "채팅방 타입은 필수입니다.",
	}),
	imageUrl: z.url().nullish(),
	maxMembers: z.int().positive().default(100),
}) satisfies z.ZodType<
	Pick<
		InsertChatRoom,
		"name" | "description" | "type" | "maxMembers" | "imageUrl"
	>
>;
export type CreateChatRoomInput = z.infer<typeof createChatRoomSchema>;

export const JoinMemeberSchema = z.object({
	chatRoomId: z.int(),
	userId: z.int(),
	role: z.enum(MEMBER_ROLES),
}) satisfies z.ZodType<
	Pick<InsertChatRoomMembers, "userId" | "chatRoomId" | "role">
>;

export type JoinMemberInput = z.infer<typeof JoinMemeberSchema>;

export const sendMessageSchema = z.object({
	chatRoomId: z.int({ error: "채팅방 ID는 필수입니다." }).positive(),
	type: z.enum(MESSAGE_TYPES, {
		error: "메시지 타입은 필수입니다.",
	}),
	content: z.string().nullish(),
}) satisfies z.ZodType<Pick<InsertMessage, "chatRoomId" | "type" | "content">>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export enum MessageDirection {
	BEFORE = "BEFORE",
	AFTER = "AFTER",
}

export const cursorPageSchema = z.object({
	cursor: z.int().positive().nullish().default(null),
	limit: z.int().min(1).max(100).default(50),
});
export type CursorPageInput = z.infer<typeof cursorPageSchema>;

export const messagePageSchema = cursorPageSchema.extend({
	chatRoomId: z.int({ error: "채팅방 ID는 필수입니다." }).positive(),
	direction: z.enum(MessageDirection).default(MessageDirection.BEFORE),
});
export type MessagePageInput = z.infer<typeof messagePageSchema>;

export interface MessageDto
	extends Serialized<Omit<SelectMessage, "senderId">> {
	sender: UserDto;
}

export interface ChatRoomDto
	extends Serialized<Omit<SelectChatRoom, "createdBy" | "updatedAt">> {
	memberCount: number;
	createdBy: UserDto;
	lastMessage: MessageDto | null;
}

export interface ChatRoomMemberDto
	extends Serialized<
		Omit<SelectChatRoomMembers, "chatRoomId" | "userId" | "createdAt">
	> {
	user: UserDto;
}
