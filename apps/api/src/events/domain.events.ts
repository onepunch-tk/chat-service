import { MessageDto } from "@repo/shared-types";

/**
 * 내부 도메인 이벤트(Nest EventEmitter2) 계약.
 *
 * FE 번들로 건너가지 않는 "백엔드 전용" 이벤트라 shared-types가 아니라 apps/api에 둔다
 * (shared-types는 FE/BE 공유 wire 계약 전용). emit과 @OnEvent 양쪽이 이 맵을 단일
 * 소스로 참조해 이벤트 이름·payload가 함께 강제되도록 한다.
 */
export interface ChatDomainEvents {
	"chatRoom.memberJoined": { userId: number; roomId: number };
	"chatRoom.memberLeft": { userId: number; roomId: number };
	"message.sent": { roomId: number; message: MessageDto };
}

export interface SessionDomainEvents {
	"session.terminated": { sessionId: string };
}

export type DomainEvents = ChatDomainEvents & SessionDomainEvents;

/**
 * @OnEvent 데코레이터용 이벤트 이름 가드. emit 측은 TypedEventEmitter가 이미 이름을
 * 강제하지만 @OnEvent 문자열은 무검증이라, 이 헬퍼들로 각 도메인 맵의 keyof에 묶어
 * 오타를 컴파일 에러로 만든다. ws.dto.ts의 clientEvent()와 같은 패턴.
 */
export const chatEvent = <K extends keyof ChatDomainEvents>(name: K) => name;
export const sessionEvent = <K extends keyof SessionDomainEvents>(name: K) =>
	name;
