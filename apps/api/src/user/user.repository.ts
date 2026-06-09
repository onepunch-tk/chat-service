import { Inject, Injectable } from "@nestjs/common";
import { count, type DrizzleDB, desc, eq, ilike, or, sql } from "@repo/db";
import { SelectUser, users } from "@repo/db/schemas";
import type { CreateUserInput, SearchQueryInput } from "@repo/shared-types";
import { DRIZZLE } from "../database/database.constant";
import { escapeLike } from "../database/like.util";

@Injectable()
export class UserRepository {
	constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

	/** password는 service에서 해시되어 들어온다. 동시 가입 충돌 시 null을 반환한다. */
	async createUser(newUser: CreateUserInput): Promise<SelectUser | null> {
		const [user] = await this.db
			.insert(users)
			.values(newUser)
			.onConflictDoNothing({ target: users.username })
			.returning();

		return user ?? null;
	}

	async findByUserId(userId: number): Promise<SelectUser | null> {
		const [user] = await this.db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		return user ?? null;
	}

	async findByUsername(username: string): Promise<SelectUser | null> {
		const [user] = await this.db
			.select()
			.from(users)
			.where(eq(users.username, username))
			.limit(1);

		return user ?? null;
	}

	async existsByUsername(username: string): Promise<boolean> {
		const [user] = await this.db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.username, username))
			.limit(1);

		return user !== undefined;
	}

	async updateLastSeenAt(userId: number): Promise<SelectUser | null> {
		const [user] = await this.db
			.update(users)
			.set({ lastSeenAt: sql`now()` })
			.where(eq(users.id, userId))
			.returning();

		return user ?? null;
	}

	async searchUsers({
		query,
		limit,
		offset,
	}: SearchQueryInput): Promise<{ rows: SelectUser[]; total: number }> {
		const relevance = sql`greatest(
      similarity(${users.username}, ${query}),
      similarity(${users.displayName}, ${query})
    )`;
		const where = or(
			ilike(users.username, `%${escapeLike(query)}%`),
			ilike(users.displayName, `%${escapeLike(query)}%`),
		);

		const [rows, [{ total }]] = await Promise.all([
			this.db
				.select()
				.from(users)
				.where(where)
				.orderBy(desc(relevance), desc(users.id))
				.limit(limit)
				.offset(offset),
			this.db.select({ total: count() }).from(users).where(where),
		]);

		return { rows, total };
	}
}
