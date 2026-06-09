import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { SessionService } from "./session.service";

/**
 * 세션 인증(로그인/로그아웃·단일 활성 세션·rolling TTL·WS 가드) 단위.
 *
 * 이전엔 AppModule providers에 SessionService가 떠 있었으나, 모듈로 묶어 RedisModule
 * 의존을 명시하고 SessionService를 import 가능한 단위로 export한다. 로그인 컨트롤러나
 * WS 가드(UC-5)가 생기면 이 모듈을 import해서 주입받는다.
 */
@Module({
	imports: [RedisModule],
	providers: [SessionService],
	exports: [SessionService],
})
export class SessionModule {}
