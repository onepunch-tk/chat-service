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
import { chatRoomMembers, chatRooms, SelectChatRoom } from "@repo/db/schemas";
import type { CreateChatRoomInput, CursorPageInput } from "@repo/shared-types";
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

	async findChatRoomsByUserId(
		userId: number,
		{ cursor, limit }: CursorPageInput,
	): Promise<SelectChatRoom[]> {
		const cursorRoom = alias(chatRooms, "cursor_room");
		const cursorCondition = cursor
			? sql`(${chatRooms.updatedAt}, ${chatRooms.id}) < (${this.db
					.select({ updatedAt: cursorRoom.updatedAt, id: cursorRoom.id })
					.from(cursorRoom)
					.where(eq(cursorRoom.id, cursor))})`
			: undefined;

		return this.db
			.select(getTableColumns(chatRooms))
			.from(chatRooms)
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

	async findActiveChatRooms(): Promise<SelectChatRoom[]> {
		return this.db
			.select()
			.from(chatRooms)
			.where(and(eq(chatRooms.isActive, true)))
			.orderBy(desc(chatRooms.createdAt));
	}

	async searchActiveChatRoomsByName(name: string): Promise<SelectChatRoom[]> {
		return this.db
			.select()
			.from(chatRooms)
			.where(
				and(
					ilike(chatRooms.name, `%${escapeLike(name)}%`),
					eq(chatRooms.isActive, true),
				),
			)
			.orderBy(desc(chatRooms.createdAt));
	}
}
