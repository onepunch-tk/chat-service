import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	count,
	type DrizzleDB,
	eq,
	getTableColumns,
	inArray,
	sql,
} from "@repo/db";
import {
	ChatRoomMemberWithMemberRelations,
	chatRoomMembers,
	type SelectChatRoomMembers,
	users,
} from "@repo/db/schemas";
import { JoinMemberInput } from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";

/** 멤버십 식별 복합키 — number 위치 인자 둘은 스왑이 컴파일에 안 잡히므로 객체로 고정한다. */
export type ChatRoomMemberKey = Pick<JoinMemberInput, "chatRoomId" | "userId">;

@Injectable()
export class ChatRoomMemberRepository {
	constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

	async joinMember(
		joinMember: JoinMemberInput,
		db: DrizzleDB = this.db,
	): Promise<void> {
		await db
			.insert(chatRoomMembers)
			.values(joinMember)
			.onConflictDoUpdate({
				target: [chatRoomMembers.chatRoomId, chatRoomMembers.userId],
				set: {
					isActive: true,
					leftAt: null,
					joinedAt: sql`now()`,
					role: joinMember.role,
				},
			});
	}

	async findActiveMembers(
		chatRoomId: number,
	): Promise<ChatRoomMemberWithMemberRelations[]> {
		return this.db
			.select({
				...getTableColumns(chatRoomMembers),
				user: getTableColumns(users),
			})
			.from(chatRoomMembers)
			.innerJoin(users, eq(users.id, chatRoomMembers.userId))
			.where(
				and(
					eq(chatRoomMembers.chatRoomId, chatRoomId),
					eq(chatRoomMembers.isActive, true),
				),
			)
			.orderBy(chatRoomMembers.joinedAt);
	}

	async findActiveMember({
		chatRoomId,
		userId,
	}: ChatRoomMemberKey): Promise<SelectChatRoomMembers | null> {
		const [member] = await this.db
			.select()
			.from(chatRoomMembers)
			.where(
				and(
					eq(chatRoomMembers.chatRoomId, chatRoomId),
					eq(chatRoomMembers.userId, userId),
					eq(chatRoomMembers.isActive, true),
				),
			)
			.limit(1);
		return member ?? null;
	}

	async countActiveMembersByRoomIds(
		roomIds: number[],
	): Promise<Map<number, number>> {
		const result = await this.db
			.select({
				chatRoomId: chatRoomMembers.chatRoomId,
				count: count(),
			})
			.from(chatRoomMembers)
			.where(
				and(
					inArray(chatRoomMembers.chatRoomId, roomIds),
					eq(chatRoomMembers.isActive, true),
				),
			)
			.groupBy(chatRoomMembers.chatRoomId);

		return new Map(result.map(({ chatRoomId, count }) => [chatRoomId, count]));
	}

	async leave({ chatRoomId, userId }: ChatRoomMemberKey): Promise<boolean> {
		const result = await this.db
			.update(chatRoomMembers)
			.set({
				isActive: false,
				leftAt: sql`now()`,
			})
			.where(
				and(
					eq(chatRoomMembers.chatRoomId, chatRoomId),
					eq(chatRoomMembers.userId, userId),
					eq(chatRoomMembers.isActive, true),
				),
			);

		return (result.rowCount ?? 0) > 0;
	}

	async existsActiveMember({
		chatRoomId,
		userId,
	}: ChatRoomMemberKey): Promise<boolean> {
		const [member] = await this.db
			.select({ one: sql`1` })
			.from(chatRoomMembers)
			.where(
				and(
					eq(chatRoomMembers.chatRoomId, chatRoomId),
					eq(chatRoomMembers.userId, userId),
					eq(chatRoomMembers.isActive, true),
				),
			)
			.limit(1);

		return member !== undefined;
	}
}
