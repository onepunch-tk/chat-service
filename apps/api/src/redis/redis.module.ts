import { Inject, Logger, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type RedisClientType } from "redis";
import { REDIS_CLIENT } from "./redis.constant";
import { RedisService } from "./redis.service";

@Module({
	providers: [
		{
			provide: REDIS_CLIENT,
			useFactory: async (config: ConfigService) => {
				const redisClient = createClient({
					url: `redis://${config.getOrThrow<string>("REDIS_HOST")}:${config.getOrThrow<number>("REDIS_PORT")}`,
					username: config.getOrThrow<string>("REDIS_USERNAME"),
					password: config.getOrThrow<string>("REDIS_PASSWORD"),
				});
				redisClient.on("error", (error) =>
					new Logger(REDIS_CLIENT.toString()).error(error),
				);

				await redisClient.connect();
				return redisClient;
			},
			inject: [ConfigService],
		},
		RedisService,
	],
	exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redisClient: RedisClientType,
	) {}

	async onApplicationShutdown() {
		await this.redisClient.close();
	}
}
