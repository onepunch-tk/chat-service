import { Injectable, Logger } from "@nestjs/common";
import type { CacheNamespace } from "./redis.constant";
import { RedisService } from "./redis.service";

/**
 * 캐시 전용 파사드. 저수준 RedisService를 감싸 "캐시 정책"을 한곳에 모은다.
 *
 * [왜 RedisService에 직접 try/catch를 넣지 않았나]
 * RedisService는 캐시뿐 아니라 세션/인증(SessionService)도 함께 쓰는 공용 도구다.
 *  - 캐시      : best-effort → fail-open(에러를 삼키고 miss로 강등, DB로 폴백)이 맞다.
 *  - 세션/인증 : fail-closed → 에러가 위로 전파돼야 한다.
 *      예) kickExistingSession의 get이 조용히 null이면 단일 활성 세션 보장이 무력화되고,
 *          terminate의 del 실패를 모르면 "로그아웃했는데 세션이 살아있는" 보안 구멍이 된다.
 * 즉 에러 정책은 "저장소(Redis)"가 아니라 "용도(캐시 vs 세션)"의 속성이다. 그래서 공용
 * primitive에 박지 않고, fail-open은 이 캐시 레이어에만 둔다(세션은 RedisService 직접 사용).
 */
@Injectable()
export class CacheService {
	private readonly logger = new Logger(CacheService.name);

	constructor(private readonly redisService: RedisService) {}

	async get<T>(
		namespace: CacheNamespace,
		key: string | number,
	): Promise<T | null> {
		try {
			return await this.redisService.get<T>(namespace, key);
		} catch (error) {
			// 읽기 실패는 miss로 강등 → 호출부가 DB로 재계산한다.
			this.logger.warn(`cache get failed (${namespace}:${key})`, error);
			return null;
		}
	}

	async set(
		namespace: CacheNamespace,
		key: string | number,
		value: unknown,
	): Promise<void> {
		try {
			await this.redisService.set(namespace, key, value);
		} catch (error) {
			// 쓰기 실패는 무시 — 이미 계산된 값은 그대로 반환된다.
			this.logger.warn(`cache set failed (${namespace}:${key})`, error);
		}
	}

	async del(namespace: CacheNamespace, key: string | number): Promise<void> {
		try {
			await this.redisService.del(namespace, key);
		} catch (error) {
			this.logger.warn(`cache del failed (${namespace}:${key})`, error);
		}
	}

	/** namespace 전체 비우기 — Spring @CacheEvict(allEntries=true) 대응. */
	async clear(namespace: CacheNamespace): Promise<void> {
		try {
			await this.redisService.clear(namespace);
		} catch (error) {
			this.logger.warn(`cache clear failed (${namespace}:*)`, error);
		}
	}

	/**
	 * read-through: 캐시 히트면 그대로, 미스면 factory로 계산 후 캐싱하고 반환한다.
	 * 주의: 히트 판정이 `!== null`이라 null 값 자체는 캐싱되지 않는다(negative caching X).
	 */
	async getOrSet<T>(
		namespace: CacheNamespace,
		key: string | number,
		factory: () => T | Promise<T>,
	): Promise<T> {
		const cached = await this.get<T>(namespace, key);
		if (cached !== null) return cached;

		const value = await factory();
		await this.set(namespace, key, value);
		return value;
	}

	/**
	 * getOrSet의 배치 버전 — loader를 키 하나가 아니라 미스난 키 묶음 단위로 호출해
	 * DB N+1을 막는다. 반환은 입력 keys 순서를 보존한다. factory가 못 돌려준 키는
	 * 결과에서 빠지며, getOrSet처럼 negative caching은 없다(null/undefined는 캐싱·반환 안 됨).
	 */
	async getOrSetMany<K extends string | number, T>(
		namespace: CacheNamespace,
		keys: K[],
		factory: (missedKeys: K[]) => Promise<Map<number | string, T>>,
	): Promise<T[]> {
		// 키별 GET — Promise.all이 결과를 keys와 같은 인덱스에 정렬(auto-pipelined) RTT=1.
		const cached = await Promise.all(
			keys.map((k) => this.get<T>(namespace, k)),
		);
		// cached[i] === null인 위치의 키만 추려 미스 목록
		const missedKeys = keys.filter((_, i) => cached[i] === null);
		// 미스가 있을 때만 배치 계산 — factory는 "키 → 값" Map을 돌려준다(순서 무의미).
		const computed =
			missedKeys.length > 0 ? await factory(missedKeys) : new Map<K, T>();

		if (computed.size > 0) {
			await Promise.all(
				[...computed].map(([k, v]) => this.set(namespace, k, v)),
			);
		}

		// 순서는 keys가, 값 대응은 Map.get이 담당. 히트면 cached, 미스면 computed.
		return keys
			.map((k, i) => cached[i] ?? computed.get(k))
			.filter((v): v is T => v != null);
	}
}
