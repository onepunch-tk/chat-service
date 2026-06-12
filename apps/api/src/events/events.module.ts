import { Module } from "@nestjs/common";
import { TypedEventEmitter } from "./typed-event-emitter";

/**
 * 앱 내부 도메인 이벤트 버스 단위 — WS 인프라가 아니라 EventEmitter2 facade를 담는다.
 * 이벤트를 emit하는 도메인 모듈(chat·session)이 이 모듈을 import해 TypedEventEmitter를
 * 주입받는다. 수신(@OnEvent)은 전역 EventEmitterModule이 담당하므로 import가 필요 없다.
 */
@Module({
	providers: [TypedEventEmitter],
	exports: [TypedEventEmitter],
})
export class EventsModule {}
