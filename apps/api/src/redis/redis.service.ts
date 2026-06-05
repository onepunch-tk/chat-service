import { Inject, Injectable } from "@nestjs/common";
import type { RedisClientType } from "redis";
import { CACHE_TTL, type CacheNamespace, REDIS_CLIENT } from "./redis.constant";

@Injectable()
export class RedisService {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redisClient: RedisClientType,
	) {}

	async set(namespace: CacheNamespace, key: string, value: unknown) {
		await this.redisClient.set(`${namespace}:${key}`, JSON.stringify(value), {
			expiration: { type: "EX", value: CACHE_TTL[namespace] },
		});
	}
}
