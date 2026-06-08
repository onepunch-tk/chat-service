import {
	Global,
	Inject,
	Logger,
	Module,
	OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DbClient, DrizzleDB } from "@repo/db";
import { createDbClient } from "@repo/db";
import { DB_CLIENT, DRIZZLE, QueryLogger } from "./database.constant";

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
