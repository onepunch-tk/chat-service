import { Inject, Injectable } from "@nestjs/common";
import type { RedisClientType } from "redis";
import { CACHE_TTL, type CacheNamespace, REDIS_CLIENT } from "./redis.constant";

@Injectable()
export class RedisService {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redisClient: RedisClientType,
	) {}

	async set(namespace: CacheNamespace, key: string | number, value: unknown) {
		await this.redisClient.set(`${namespace}:${key}`, JSON.stringify(value), {
			expiration: { type: "EX", value: CACHE_TTL[namespace] },
		});
	}

	async get<T>(
		namespace: CacheNamespace,
		key: string | number,
	): Promise<T | null> {
		const raw = await this.redisClient.get(`${namespace}:${key}`);
		return raw ? (JSON.parse(raw) as T) : null;
	}

	async del(namespace: CacheNamespace, key: string | number): Promise<number> {
		return this.redisClient.del(`${namespace}:${key}`);
	}

	async expire(namespace: CacheNamespace, key: string | number) {
		await this.redisClient.expire(`${namespace}:${key}`, CACHE_TTL[namespace]);
	}
}
