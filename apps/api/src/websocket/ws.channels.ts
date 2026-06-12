/**
 * socket.io / redis-adapter room 키 빌더.
 *
 * load-bearing 프로토콜.
 * 그리고 향후 멤버 입장/퇴장 미러링이 모두 같은 키를 타깃해야 한다. socketsJoin/emit은
 * 매칭되는 room이 없으면 "조용한 no-op"이라, 한 글자 오타가 런타임 에러 없이 메시지를
 * 아무 데도 전달하지 않는다. 빌더로 단일화해 그 오타를 호출부 컴파일 에러로 만든다.
 *
 * - `userChannel(id)` → 해당 유저의 모든 활성 소켓(멀티탭·크로스 인스턴스)
 * - `roomChannel(id)` → 채팅방
 */
export const userChannel = (userId: number) => `user:${userId}` as const;
export const roomChannel = (roomId: number) => `room:${roomId}` as const;
export const sessionChannel = (sessionId: string) =>
	`session:${sessionId}` as const;
