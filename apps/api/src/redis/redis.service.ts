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

	/**
	 * LIST의 head(index 0)부터 count개를 조회해 역직렬화한다.
	 *
	 * @param namespace 캐시 네임스페이스
	 * @param key LIST 키
	 * @param count head부터 조회할 개수
	 * @returns 역직렬화된 항목 배열 — 키가 없으면 빈 배열
	 */
	async lRange<T>(
		namespace: CacheNamespace,
		key: string | number,
		count: number,
	): Promise<T[]> {
		const raw = await this.redisClient.lRange(
			`${namespace}:${key}`,
			0,
			count - 1,
		);
		return raw.map((s) => JSON.parse(s) as T);
	}

	/**
	 * LIST를 통째로 재구축한다 — DEL → RPUSH → EXPIRE를 MULTI 한 묶음으로 실행한다.
	 * RPUSH는 입력 배열 순서를 보존하므로, head=최신을 원하면 호출부가 "최신 먼저"로
	 * 정렬해 넘겨야 한다. LIST 생성은 이 메서드만 한다(lPushTrim은 LPUSHX라 생성 불가).
	 *
	 * @param namespace 캐시 네임스페이스
	 * @param key LIST 키
	 * @param values 저장할 값 배열 — head에 올 항목부터 순서대로
	 */
	async lRebuild<T>(
		namespace: CacheNamespace,
		key: string | number,
		values: T[],
	) {
		const k = `${namespace}:${key}`;
		await this.redisClient
			.multi()
			.del(k)
			.rPush(
				k,
				values.map((v) => JSON.stringify(v)),
			)
			.expire(k, CACHE_TTL[namespace])
			.exec();
	}

	/**
	 * LIST head에 1건을 추가하고 max개로 절단한다 — LPUSHX → LTRIM → EXPIRE MULTI.
	 * LPUSHX는 키가 없으면 no-op이다 — 부분 리스트 생성을 막아 "존재하는 리스트는
	 * 완전하다" 불변식을 지킨다.
	 *
	 * @param namespace 캐시 네임스페이스
	 * @param key LIST 키
	 * @param value head에 추가할 값
	 * @param max 유지할 최대 길이
	 */
	async lPushTrim<T>(
		namespace: CacheNamespace,
		key: string | number,
		value: T,
		max: number,
	) {
		const k = `${namespace}:${key}`;
		await this.redisClient
			.multi()
			.lPushX(k, JSON.stringify(value))
			.lTrim(k, 0, max - 1)
			.expire(k, CACHE_TTL[namespace])
			.exec();
	}
}
