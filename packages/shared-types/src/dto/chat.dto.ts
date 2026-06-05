import {
	chatRoomTypesEnum,
	InsertChatRoom,
	InsertMessage,
	messageTypesEnum,
	SelectChatRoom,
	SelectChatRoomMembers,
	SelectMessage,
} from "@repo/db/schemas";
import * as z from "zod";
import { Serialized } from "./serialized";
import { UserDto } from "./user.dto";

export const CreateChatRoomRequest = z.object({
	name: z
		.string({ error: "채팅방 이름은 필수입니다." })
		.trim()
		.min(1, { error: "채팅방 이름은 1-100자 사이여야 합니다." })
		.max(100, { error: "채팅방 이름은 1-100자 사이여야 합니다." }),
	description: z.string().nullish(),
	type: z.enum(chatRoomTypesEnum.enumValues, {
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
export type CreateChatRoomRequest = z.infer<typeof CreateChatRoomRequest>;

export const SendMessageRequest = z.object({
	chatRoomId: z.int({ error: "채팅방 ID는 필수입니다." }).positive(),
	type: z.enum(messageTypesEnum.enumValues, {
		error: "메시지 타입은 필수입니다.",
	}),
	content: z.string().nullish(),
}) satisfies z.ZodType<Pick<InsertMessage, "chatRoomId" | "type" | "content">>;
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;

export enum MessageDirection {
	BEFORE = "BEFORE",
	AFTER = "AFTER",
}

export const MessagePageRequest = z.object({
	chatRoomId: z.int({ error: "채팅방 ID는 필수입니다." }).positive(),
	cursor: z.int().positive().nullish().default(null),
	limit: z.int().min(1).max(100).default(50),
	direction: z.enum(MessageDirection).default(MessageDirection.BEFORE),
});
export type MessagePageRequest = z.infer<typeof MessagePageRequest>;

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

export interface MessagePageResponse {
	messages: MessageDto[];
	nextCursor: number | null;
	prevCursor: number | null;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface ChatRoomMemberDto
	extends Serialized<
		Omit<SelectChatRoomMembers, "chatRoomId" | "userId" | "createdAt">
	> {
	user: UserDto;
}
