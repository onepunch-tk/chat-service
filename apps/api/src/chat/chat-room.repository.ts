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
import type { CursorPageInput } from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";

@Injectable()
export class ChatRoomRepository {
	constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
				and(ilike(chatRooms.name, `%${name}%`), eq(chatRooms.isActive, true)),
			)
			.orderBy(desc(chatRooms.createdAt));
	}
}
