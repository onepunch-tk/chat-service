import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	asc,
	type DrizzleDB,
	desc,
	eq,
	getTableColumns,
	gt,
	gte,
	inArray,
	lt,
	lte,
	sql,
} from "@repo/db";
import {
	chatRooms,
	MessageWithSenderRelations,
	messages,
	SelectMessage,
	users,
} from "@repo/db/schemas";
import {
	MessageDirection,
	type MessagePageInput,
	type SendMessageInput,
} from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";

@Injectable()
export class MessageRepository {
	private readonly redactedContent = sql<
		string | null
	>`CASE WHEN ${messages.isDeleted} THEN NULL ELSE ${messages.content} END`;

	constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

	async findByChatRoomId({
		chatRoomId,
		cursor,
		limit,
		direction,
	}: MessagePageInput): Promise<MessageWithSenderRelations[]> {
		const cursorCondition = cursor
			? direction === MessageDirection.BEFORE
				? lt(messages.sequenceNumber, cursor)
				: gt(messages.sequenceNumber, cursor)
			: undefined;

		return this.db
			.select({
				...getTableColumns(messages),
				content: this.redactedContent,
				sender: getTableColumns(users),
			})
			.from(messages)
			.innerJoin(users, eq(users.id, messages.senderId))
			.where(and(eq(messages.chatRoomId, chatRoomId), cursorCondition))
			.limit(limit)
			.orderBy(
				direction === MessageDirection.BEFORE
					? desc(messages.sequenceNumber)
					: asc(messages.sequenceNumber),
			);
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
	 * 방 시퀀스를 채번하고 메시지를 저장한다 — lastSeq UPDATE의 행 락이 같은 방의
	 * 동시 전송을 직렬화해 연속 시퀀스(방식 B)를 보장한다.
	 *
	 * @param userId 발신 유저 id
	 * @param newMessage 전송 입력(chatRoomId, type, content)
	 * @returns 삽입된 메시지 row — sender 관계는 호출부가 합성한다
	 */
	async createInRoom(
		userId: number,
		newMessage: SendMessageInput,
	): Promise<SelectMessage> {
		return this.db.transaction(async (tx) => {
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
