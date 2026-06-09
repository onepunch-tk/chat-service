import { Inject, Injectable } from "@nestjs/common";
import { and, type DrizzleDB, eq, sql } from "@repo/db";
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

	async countActiveMembers(chatRoomId: number): Promise<number> {
		return this.db.$count(
			chatRoomMembers,
			and(
				eq(chatRoomMembers.chatRoomId, chatRoomId),
				eq(chatRoomMembers.isActive, true),
			),
		);
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
