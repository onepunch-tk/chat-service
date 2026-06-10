import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	asc,
	type DrizzleDB,
	desc,
	eq,
	getTableColumns,
	gte,
	inArray,
	lt,
	lte,
	sql,
} from "@repo/db";
import {
	chatRooms,
	MessageWithAllRelations,
	MessageWithSenderRelations,
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
	): Promise<MessageWithAllRelations[]> {
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

	async findLatestMessagesByRoomIds(
		roomIds: number[],
	): Promise<Map<number, MessageWithSenderRelations>> {
		// DISTINCT ON (chat_room_id): Postgres 확장 — chatRoomId가 같은 행들 중 ORDER BY
		// 순서상 첫 행만 남긴다. ORDER BY는 반드시 DISTINCT ON 컬럼으로 시작해야 하며,
		// 두 번째 키 sequenceNumber DESC가 "방별 최신 1건"을 고른다.
		// → 방마다 LIMIT 1 쿼리를 N번 부르던 것을 쿼리 1방으로 대체.

		const result = await this.db
			.selectDistinctOn([messages.chatRoomId], {
				...getTableColumns(messages),
				sender: getTableColumns(users),
			})
			.from(messages)
			.innerJoin(users, eq(users.id, messages.senderId))
			.where(
				and(
					inArray(messages.chatRoomId, roomIds),
					eq(messages.isDeleted, false),
				),
			)
			.orderBy(messages.chatRoomId, desc(messages.sequenceNumber));

		return new Map(result.map((m) => [m.chatRoomId, m]));
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
