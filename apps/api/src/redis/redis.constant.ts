export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

export const SESSION_TTL_SECONDS = 60 * 60;

/** TTL 정책의 단일 소스 — `null`은 영속(EXPIRE 없음)을 뜻한다 */
export const CACHE_TTL = {
	users: 60 * 60, // 사용자 정보 1시간
	chatRooms: 60 * 15, // 채팅방 정보 15분
	chatRoomMembers: 60 * 10, // 멤버 정보는 10분
	messages: 60 * 5, // 메세지는 5분
	userSession: null, // userId → sessionId 인덱스 — 영속. userId당 1키라 상한 고정, 로그아웃 시 삭제·재로그인 시 덮어씀
	redisSession: SESSION_TTL_SECONDS, //로그인 redis session 정보 1시간
} as const satisfies Record<string, number | null>;

export type CacheNamespace = keyof typeof CACHE_TTL & string;

/** TTL이 있는 네임스페이스만 — 영속 네임스페이스에 EXPIRE를 거는 실수를 컴파일 타임에 막는다 */
export type ExpiringNamespace = {
	[K in CacheNamespace]: (typeof CACHE_TTL)[K] extends number ? K : never;
}[CacheNamespace];

const REDIS_SESSION_KEY = "redisSession" satisfies CacheNamespace;
export const REDIS_SESSION_PREFIX = `${REDIS_SESSION_KEY}:` as const;

export const RECENT_MESSAGES_MAX = 50;
