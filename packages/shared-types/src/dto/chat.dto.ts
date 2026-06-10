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
import { cursorPageSchema } from "./search.dto";
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

export const messagePageSchema = cursorPageSchema.extend({
	chatRoomId: z.int({ error: "채팅방 ID는 필수입니다." }).positive(),
	direction: z.enum(MessageDirection).default(MessageDirection.BEFORE),
});
export type MessagePageInput = z.infer<typeof messagePageSchema>;

export interface MessageDto
	extends Serialized<Omit<SelectMessage, "senderId">> {
	sender: UserDto;
}

// lastSeq는 방별 메시지 시퀀스용 내부 카운터다. wire로 내보내면 방의 메시지 볼륨이
// 드러나는 단조 카운터를 노출하는 셈이고 Kotlin 원본 DTO에도 없으므로 Omit한다.
// 주의: 타입에서 Omit해도 chatRoomToDto의 `...rest` 스프레드로는 런타임에 여전히
// 새어나가므로(스프레드 속성엔 excess property check 미적용), 매퍼 구조분해에서도 빼야 한다.
export interface ChatRoomDto
	extends Serialized<
		Omit<SelectChatRoom, "createdBy" | "updatedAt" | "lastSeq">
	> {
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
