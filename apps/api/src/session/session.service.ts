import { Injectable, Logger } from "@nestjs/common";
import { Request } from "express";
import { RedisService } from "../redis/redis.service";

/**
 * 로그인 세션의 수립·종료를 담당하고, 사용자당 단일 활성 세션을 보장한다.
 *
 * - 로그인 시: 기존 세션을 정리하고 세션 ID를 재발급(세션 고정 공격 방지)한 뒤
 *   `userId ↔ sessionId` 매핑을 Redis에 기록한다.
 * - 로그아웃 시: 매핑을 제거하고 세션을 파기한다.
 */
@Injectable()
export class SessionService {
	constructor(private readonly redisService: RedisService) {}

	private readonly logger = new Logger(SessionService.name);

	/**
	 * 로그인 성공 시 호출해 인증 세션을 수립한다.
	 *
	 * 1. 같은 사용자의 이전 세션을 강제 종료한다(중복 로그인 방지).
	 * 2. 세션 ID를 재발급한다(세션 고정 공격 방지).
	 * 3. 세션에 `userId`를 바인딩한다.
	 * 4. `userId → 현재 sessionId` 매핑을 Redis에 저장한다.
	 *
	 * @param req 현재 요청(express-session 세션 포함)
	 * @param userId 로그인한 사용자 ID
	 */
	async establish(req: Request, userId: number) {
		await this.kickExistingSession(userId);
		await this.regenerate(req);

		req.session.userId = userId;

		await this.redisService.set("userSession", userId, req.sessionID);
	}

	/**
	 * 로그아웃 시 호출해 인증 세션을 종료한다.
	 *
	 * `userId → sessionId` 매핑을 제거한 뒤 세션 자체를 파기한다.
	 *
	 * @param req 현재 요청(express-session 세션 포함)
	 */
	async terminate(req: Request) {
		const userId = req.session.userId;
		if (userId) await this.redisService.del("userSession", userId);

		await this.destroy(req);
	}

	/**
	 * 세션을 sessionId로 재검증하고, 유효하면 수명을 연장(rolling)한다.
	 * WS 메시지마다 가드(UC-5)에서 호출하는 것을 의도한다 —
	 * 핸드셰이크 시점의 스냅샷이 아니라 매번 저장소를 재조회하므로 만료·로그아웃을 잡아낸다.
	 *
	 * @param sessionId 검증·연장할 세션 ID
	 * @returns 세션이 살아 있으면 `"VALID"`, 없으면(만료/로그아웃) `"INVALID"`
	 */
	async touch(sessionId: string): Promise<"INVALID" | "VALID"> {
		// 저장소 재조회: 키가 이미 만료돼 자동 삭제됐다면 null → 무효 세션
		const session = await this.redisService.get<{ userId: number }>(
			"redisSession",
			sessionId,
		);

		if (!session?.userId) return "INVALID";

		// 세션 본체와 역방향 인덱스의 TTL을 같은 시점에 함께 리셋(rolling).
		// 한쪽만 밀면 인덱스가 먼저 만료돼 단일 세션 kick이 헛도므로 반드시 한 묶음으로.
		await this.redisService.expire("redisSession", sessionId); // 본체 TTL만 연장(값 보존)
		await this.redisService.set("userSession", session.userId, sessionId); // 인덱스도 갱신

		return "VALID";
	}

	/**
	 * 같은 사용자의 이전 활성 세션을 세션 저장소에서 제거한다.
	 * 한 사용자가 동시에 여러 세션을 갖지 못하도록(단일 활성 세션) 강제한다.
	 *
	 * @param userId 대상 사용자 ID
	 */
	private async kickExistingSession(userId: number): Promise<void> {
		const oldId = await this.redisService.get<string>("userSession", userId);

		if (oldId) await this.redisService.del("redisSession", oldId);
	}

	/**
	 * 현재 세션을 새 세션 ID로 재발급한다(세션 고정 공격 방지).
	 * 콜백 기반 `req.session.regenerate`를 Promise로 감싼다.
	 *
	 * @param req 현재 요청(express-session 세션 포함)
	 * @returns 재발급이 끝나면 resolve되는 Promise
	 */
	private async regenerate(req: Request): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			req.session.regenerate((err) => {
				if (err) {
					this.logger.error(err);
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * 현재 세션을 저장소와 쿠키에서 파기한다.
	 * 콜백 기반 `req.session.destroy`를 Promise로 감싼다.
	 *
	 * @param req 현재 요청(express-session 세션 포함)
	 * @returns 파기가 끝나면 resolve되는 Promise
	 */
	private async destroy(req: Request): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			req.session.destroy((err) => {
				if (err) {
					this.logger.error(err);
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}
