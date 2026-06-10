import { Inject, Injectable } from "@nestjs/common";
import { and, count, type DrizzleDB, eq, inArray, sql } from "@repo/db";
import { chatRoomMembers, type SelectChatRoomMembers } from "@repo/db/schemas";
import { JoinMemberInput } from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";

@Injectable()
export class ChatRoomMemberRepository {
	constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

	async joinMember(
		joinMember: JoinMemberInput,
		db: DrizzleDB = this.db,
	): Promise<void> {
		await db.insert(chatRoomMembers).values(joinMember);
	}

	async findActiveMembers(
		chatRoomId: number,
	): Promise<SelectChatRoomMembers[]> {
		return this.db
			.select()
			.from(chatRoomMembers)
			.where(
				and(
					eq(chatRoomMembers.chatRoomId, chatRoomId),
					eq(chatRoomMembers.isActive, true),
				),
			);
	}

	async findActiveMember(
		chatRoomId: number,
		userId: number,
	): Promise<SelectChatRoomMembers | null> {
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

	async leave(chatRoomId: number, userId: number): Promise<boolean> {
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

	async existsActiveMember(
		chatRoomId: number,
		userId: number,
	): Promise<boolean> {
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
