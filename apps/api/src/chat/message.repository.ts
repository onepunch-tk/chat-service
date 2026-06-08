import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	and,
	asc,
	type DrizzleDB,
	desc,
	eq,
	getTableColumns,
	gte,
	lt,
	lte,
	sql,
} from "@repo/db";
import {
	chatRooms,
	MessageWithRelations,
	messages,
	SelectMessage,
	users,
} from "@repo/db/schemas";
import type { CursorPageInput, SendMessageInput } from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";

@Injectable()
export class MessageRepository {
	private readonly redactedContent = sql<
		string | null
	>`CASE WHEN ${messages.isDeleted} THEN NULL ELSE ${messages.content} END`;

	constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

	async findByChatRoomId(
		chatRoomId: number,
		{ cursor, limit }: CursorPageInput,
	): Promise<MessageWithRelations[]> {
		return this.db
			.select({
				...getTableColumns(messages),
				content: this.redactedContent,
				chatRoom: getTableColumns(chatRooms),
				sender: getTableColumns(users),
			})
			.from(messages)
			.innerJoin(chatRooms, eq(chatRooms.id, messages.chatRoomId))
			.innerJoin(users, eq(users.id, messages.senderId))
			.where(
				and(
					eq(messages.chatRoomId, chatRoomId),
					cursor ? lt(messages.sequenceNumber, cursor) : undefined,
				),
			)
			.limit(limit)
			.orderBy(desc(messages.sequenceNumber));
	}

	async findLatestMessage(chatRoomId: number): Promise<SelectMessage | null> {
		const [message] = await this.db
			.select()
			.from(messages)
			.where(
				and(eq(messages.chatRoomId, chatRoomId), eq(messages.isDeleted, false)),
			)
			.orderBy(desc(messages.sequenceNumber))
			.limit(1);

		return message ?? null;
	}

	/**
	 * seq + save
	 */
	async createInRoom(
		userId: number,
		newMessage: SendMessageInput,
	): Promise<SelectMessage> {
		return this.db.transaction(async (tx) => {
			// room lastSeq 업데이트
			const [room] = await tx
				.update(chatRooms)
				.set({ lastSeq: sql`${chatRooms.lastSeq} + 1` })
				.where(eq(chatRooms.id, newMessage.chatRoomId))
				.returning({ lastSeq: chatRooms.lastSeq });

			if (!room) throw new NotFoundException("채팅방을 찾을 수 없습니다.");

			const [message] = await tx
				.insert(messages)
				.values({
					...newMessage,
					senderId: userId,
					sequenceNumber: room.lastSeq,
				})
				.returning();

			return message;
		});
	}

	async findRange(
		chatRoomId: number,
		fromSeq: number,
		toSeq: number,
	): Promise<SelectMessage[]> {
		return this.db
			.select({
				...getTableColumns(messages),
				content: this.redactedContent,
			})
			.from(messages)
			.where(
				and(
					eq(messages.chatRoomId, chatRoomId),
					gte(messages.sequenceNumber, fromSeq),
					lte(messages.sequenceNumber, toSeq),
				),
			)
			.orderBy(asc(messages.sequenceNumber));
	}
}
