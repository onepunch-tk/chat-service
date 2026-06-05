import {
	Global,
	Inject,
	Logger,
	Module,
	OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDbClient } from "@repo/db";
import type { DbClient, DrizzleDB, DrizzleLogger } from "@repo/db";

class QueryLogger implements DrizzleLogger {
	private readonly logger = new Logger("DrizzleQuery");

	logQuery(query: string, params: unknown[]): void {
		this.logger.log(`${query} -- params: ${JSON.stringify(params)}`);
	}
}

export const DB_CLIENT = Symbol("DB_CLIENT");
export const DRIZZLE = Symbol("DRIZZLE");

@Global()
@Module({
	providers: [
		{
			provide: DB_CLIENT,
			inject: [ConfigService],
			useFactory: (config: ConfigService): DbClient =>
				createDbClient(
					{
						host: config.getOrThrow<string>("PG_HOST"),
						port: config.getOrThrow<number>("PG_PORT"),
						user: config.getOrThrow<string>("PG_USERNAME"),
						password: config.getOrThrow<string>("PG_PASSWORD"),
						database: config.getOrThrow<string>("PG_DBNAME"),
					},
					new QueryLogger(),
				),
		},
		{
			provide: DRIZZLE,
			inject: [DB_CLIENT],
			useFactory: (client: DbClient): DrizzleDB => client.db,
		},
	],
	exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
	constructor(@Inject(DB_CLIENT) private readonly client: DbClient) {}

	onApplicationShutdown() {
		return this.client.close();
	}
}
