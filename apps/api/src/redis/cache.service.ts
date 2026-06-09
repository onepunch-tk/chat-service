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
}
