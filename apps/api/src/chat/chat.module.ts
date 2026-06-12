import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { RedisModule } from "../redis/redis.module";
import { UserModule } from "../user/user.module";
import { ChatService } from "./chat.service";
import { ChatRoomRepository } from "./chat-room.repository";
import { ChatRoomMemberRepository } from "./chat-room-member.repository";
import { MessageRepository } from "./message.repository";

/**
 * 채팅 도메인 단위 — 서비스·리포지토리만 갖는 순수 도메인 모듈. WS 엣지는 WsModule이
 * 담당하고, 도메인 이벤트 발행은 EventsModule의 TypedEventEmitter로 한다.
 * ChatService는 게이트웨이(WsGateway)와 향후 REST 컨트롤러가 쓰도록 export한다.
 */
@Module({
	imports: [RedisModule, UserModule, EventsModule],
	providers: [
		ChatService,
		MessageRepository,
		ChatRoomMemberRepository,
		ChatRoomRepository,
	],
	exports: [ChatService],
})
export class ChatModule {}
