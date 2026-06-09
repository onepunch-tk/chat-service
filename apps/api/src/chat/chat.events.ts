/**
 * 내부 도메인 이벤트(Nest EventEmitter2) 계약.
 *
 * FE 번들로 건너가지 않는 "백엔드 전용" 이벤트라 shared-types가 아니라 apps/api에 둔다
 * (shared-types는 FE/BE 공유 wire 계약 전용). emit과 @OnEvent 양쪽이 이 맵을 단일
 * 소스로 참조해 이벤트 이름·payload가 함께 강제되도록 한다.
 */
export interface ChatDomainEvents {
	"chatRoom.created": { creatorId: number; roomId: number };
}

export type ChatEventName = keyof ChatDomainEvents;
