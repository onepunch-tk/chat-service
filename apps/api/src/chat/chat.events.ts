/**
 * 내부 도메인 이벤트(Nest EventEmitter2) 계약.
 *
 * FE 번들로 건너가지 않는 "백엔드 전용" 이벤트라 shared-types가 아니라 apps/api에 둔다
 * (shared-types는 FE/BE 공유 wire 계약 전용). emit과 @OnEvent 양쪽이 이 맵을 단일
 * 소스로 참조해 이벤트 이름·payload가 함께 강제되도록 한다.
 */
export interface ChatDomainEvents {
	"chatRoom.created": { creatorId: number; roomId: number };
	"chatRoom.memberLeft": { userId: number; roomId: number };
}

/**
 * @OnEvent 데코레이터용 이벤트 이름 가드. emit 측은 TypedEventEmitter가 이미 이름을
 * 강제하지만 @OnEvent 문자열은 무검증이라, 이 헬퍼로 keyof ChatDomainEvents에 묶어
 * 오타를 컴파일 에러로 만든다. ws.dto.ts의 clientEvent()와 같은 패턴.
 */
export const chatEvent = <K extends keyof ChatDomainEvents>(name: K) => name;
