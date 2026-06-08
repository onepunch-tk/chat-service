import { Logger } from "@nestjs/common";
import { DrizzleLogger } from "@repo/db";

export class QueryLogger implements DrizzleLogger {
	private readonly logger = new Logger("DrizzleQuery");

	logQuery(query: string, params: unknown[]): void {
		this.logger.log(`${query} -- params: ${JSON.stringify(params)}`);
	}
}

export const DB_CLIENT = Symbol("DB_CLIENT");
export const DRIZZLE = Symbol("DRIZZLE");
