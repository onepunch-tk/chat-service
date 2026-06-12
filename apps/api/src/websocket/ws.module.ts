import { Module } from "@nestjs/common";
import { ChatModule } from "../chat/chat.module";
import { SessionModule } from "../session/session.module";
import { WsGateway } from "./ws.gateway";

/**
 * WS 엣지(어댑터) 단위 — 이 앱의 유일한 게이트웨이가 산다.
 * 게이트웨이가 호출하는 도메인(ChatService)과 핸들러 가드(WsSessionGuard)를
 * 도메인 모듈에서 가져온다. 의존 방향은 어댑터 → 도메인 단방향.
 */
@Module({
	imports: [ChatModule, SessionModule],
	providers: [WsGateway],
})
export class WsModule {}
