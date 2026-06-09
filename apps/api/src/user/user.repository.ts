import { Inject, Injectable } from "@nestjs/common";
import { count, type DrizzleDB, desc, eq, ilike, or, sql } from "@repo/db";
import { SelectUser, users } from "@repo/db/schemas";
import type { CreateUserInput, SearchUserInput } from "@repo/shared-types";
import { CryptoService } from "../crypto/crypto.service";
import { DRIZZLE } from "../database/database.constant";

@Injectable()
export class UserRepository {
	constructor(
		@Inject(DRIZZLE) private readonly db: DrizzleDB,
		private readonly cryptoService: CryptoService,
	) {}

	async createUser(newUser: CreateUserInput): Promise<SelectUser> {
		const { username, password: plainPassword, displayName } = newUser;
		const hashedPassword = await this.cryptoService.passwordHash(plainPassword);

		const [user] = await this.db
			.insert(users)
			.values({
				username,
				displayName,
				password: hashedPassword,
			})
			.returning();

		return user;
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
			.where(eq(users.username, username));

		return user !== undefined;
	}

	async updateLastSeenAt(userId: number, lastSeenAt: Date): Promise<void> {
		await this.db.update(users).set({ lastSeenAt }).where(eq(users.id, userId));
	}

	async searchUsers({
		query,
		limit,
		offset,
	}: SearchUserInput): Promise<{ rows: SelectUser[]; total: number }> {
		const relevance = sql`greatest(
      similarity(${users.username}, ${query}),
      similarity(${users.displayName}, ${query}),
    )`;
		const where = or(
			ilike(users.username, `%${query}%`),
			ilike(users.displayName, `%${query}%`),
		);

		const [rows, [{ total }]] = await Promise.all([
			this.db
				.select()
				.from(users)
				.where(where)
				.orderBy(desc(relevance))
				.limit(limit)
				.offset(offset),
			this.db.select({ total: count() }).from(users).where(where),
		]);

		return { rows, total };
	}
}
