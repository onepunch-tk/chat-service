import { Inject, Injectable } from "@nestjs/common";
import {
	alias,
	and,
	type DrizzleDB,
	desc,
	eq,
	getTableColumns,
	ilike,
	sql,
} from "@repo/db";
import {
	ChatRoomWithRelations,
	chatRoomMembers,
	chatRooms,
	SelectChatRoom,
	users,
} from "@repo/db/schemas";
import type {
	CreateChatRoomInput,
	CursorPageInput,
	SearchCursorPageInput,
} from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";
import { escapeLike } from "../database/like.util";
import { ChatRoomMemberRepository } from "./chat-room-member.repository";

@Injectable()
export class ChatRoomRepository {
	constructor(
		@Inject(DRIZZLE) private readonly db: DrizzleDB,
		private readonly chatRoomMemberRepository: ChatRoomMemberRepository,
	) {}

	async createChatRoom(
		userId: number,
		newChatRoom: CreateChatRoomInput,
	): Promise<SelectChatRoom> {
		return this.db.transaction(async (tx) => {
			const [chatRoom] = await tx
				.insert(chatRooms)
				.values({
					...newChatRoom,
					createdBy: userId,
				})
				.returning();

			await this.chatRoomMemberRepository.joinMember(
				{
					chatRoomId: chatRoom.id,
					userId: chatRoom.createdBy,
					role: "OWNER",
				},
				tx,
			);

			return chatRoom;
		});
	}

	async findChatRoomById(
		roomId: number,
	): Promise<ChatRoomWithRelations | null> {
		const [chatRoom] = await this.db
			.select({
				...getTableColumns(chatRooms),
				creator: getTableColumns(users),
			})
			.from(chatRooms)
			.innerJoin(users, eq(users.id, chatRooms.createdBy))
			.where(eq(chatRooms.id, roomId))
			.limit(1);

		return chatRoom ?? null;
	}

	async findChatRoomsByUserId(
		userId: number,
		{ cursor, limit }: CursorPageInput,
	): Promise<ChatRoomWithRelations[]> {
		const cursorRoom = alias(chatRooms, "cursor_room");
		const cursorCondition = cursor
			? sql`(${chatRooms.updatedAt}, ${chatRooms.id}) < (${this.db
					.select({ updatedAt: cursorRoom.updatedAt, id: cursorRoom.id })
					.from(cursorRoom)
					.where(eq(cursorRoom.id, cursor))})`
			: undefined;

		return this.db
			.select({
				...getTableColumns(chatRooms),
				creator: getTableColumns(users),
			})
			.from(chatRooms)
			.innerJoin(users, eq(chatRooms.createdBy, users.id))
			.innerJoin(chatRoomMembers, eq(chatRooms.id, chatRoomMembers.chatRoomId))
			.where(
				and(
					eq(chatRoomMembers.userId, userId),
					eq(chatRoomMembers.isActive, true),
					eq(chatRooms.isActive, true),
					cursorCondition,
				),
			)
			.limit(limit)
			.orderBy(desc(chatRooms.updatedAt), desc(chatRooms.id));
	}

	async searchActiveChatRoomsByName({
		query,
		cursor,
		limit,
	}: SearchCursorPageInput): Promise<ChatRoomWithRelations[]> {
		const cursorRoom = alias(chatRooms, "cursor_room");
		const cursorCondition = cursor
			? sql`
			(${chatRooms.createdAt},${chatRooms.id}) < (${this.db
				.select({
					createdAt: cursorRoom.createdAt,
					id: cursorRoom.id,
				})
				.from(cursorRoom)
				.where(eq(cursorRoom.id, cursor))})`
			: undefined;

		return this.db
			.select({
				...getTableColumns(chatRooms),
				creator: getTableColumns(users),
			})
			.from(chatRooms)
			.innerJoin(users, eq(chatRooms.createdBy, users.id))
			.where(
				and(
					query ? ilike(chatRooms.name, `%${escapeLike(query)}%`) : undefined,
					eq(chatRooms.isActive, true),
					cursorCondition,
				),
			)
			.orderBy(desc(chatRooms.createdAt), desc(chatRooms.id))
			.limit(limit);
	}
}
