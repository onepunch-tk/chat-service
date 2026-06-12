import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { RedisModule } from "../redis/redis.module";
import { SessionService } from "./session.service";
import { WsSessionGuard } from "./ws-session.guard";

/**
 * 세션 인증(로그인/로그아웃·단일 활성 세션·rolling TTL·WS 가드) 단위.
 *
 * SessionService는 로그인 컨트롤러가, WsSessionGuard는 WsModule의 게이트웨이가
 * 주입받도록 export한다. session.terminated 발행은 EventsModule의
 * TypedEventEmitter로 한다.
 */
@Module({
	imports: [RedisModule, EventsModule],
	providers: [SessionService],
	exports: [SessionService],
})
export class SessionModule {}
