export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

export const CACHE_TTL = {
	users: 60 * 60, // 사용자 정보 1시간
	chatRooms: 60 * 15, // 채팅방 정보 15분
	chatRoomMembers: 60 * 10, // 멤버 정보는 10분
	messages: 60 * 5, // 메세지는 5분
} as const satisfies Record<string, number>;

export type CacheNamespace = keyof typeof CACHE_TTL & string;
