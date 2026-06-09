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

	/**
	 * 주의 — T는 역직렬화 경계에서의 "무검증 단언"이다. JSON.parse는 any를 돌려주고
	 * `as T`는 런타임 검증을 하지 않으므로, 스키마가 바뀐 stale 엔트리(예: TTL 내 배포로
	 * 남은 옛 DTO)는 새 T로 잘못 타이핑된 채 반환될 수 있다. 형태 보장이 필요하면 호출부
	 * (또는 CacheService.getOrSet)에서 zod 등으로 검증할 것.
	 */
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

	async clear(namespace: CacheNamespace): Promise<number> {
		const pattern = `${namespace}:*`;
		let deleted = 0;

		for await (const keys of this.redisClient.scanIterator({
			MATCH: pattern,
			COUNT: 100,
		})) {
			if (keys.length === 0) continue;

			deleted += await this.redisClient.unlink(keys);
		}

		return deleted;
	}
}
