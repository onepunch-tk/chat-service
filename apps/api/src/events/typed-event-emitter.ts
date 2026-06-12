import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvents } from "./domain.events";

/**
 * EventEmitter2의 untyped `emit(event: string | symbol, ...values: any[])`를
 * DomainEvents 맵으로 좁힌 얇은 facade. 이벤트 이름과 payload가 함께 추론·강제된다
 * → 오타·필드 drift가 컴파일 타임에 잡힌다.
 *
 * 수신 측(@OnEvent)은 데코레이터라 문자열에서 핸들러 타입을 추론하지 못하므로, 핸들러
 * 파라미터를 `ChatDomainEvents["..."]` 같은 도메인 맵 lookup으로 annotation해 같은
 * 맵을 단일 소스로 쓴다.
 */
@Injectable()
export class TypedEventEmitter {
	constructor(private readonly emitter: EventEmitter2) {}

	emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
		this.emitter.emit(event, payload);
	}
}
