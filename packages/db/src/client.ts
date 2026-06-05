import { Logger } from "drizzle-orm";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schemas";

export type { Logger as DrizzleLogger } from "drizzle-orm";

export type DrizzleDB = NodePgDatabase<typeof schema>;

export interface DbConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
}

export interface DbClient {
	db: DrizzleDB;
	close(): Promise<void>;
}

export function createDbClient(
	config: DbConfig,
	logger?: boolean | Logger,
): DbClient {
	const pool = new Pool(config);
	return {
		db: drizzle(pool, { schema, logger }),
		close: () => pool.end(),
	};
}
