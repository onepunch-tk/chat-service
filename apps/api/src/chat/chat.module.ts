import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { UserModule } from "../user/user.module";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { ChatRoomRepository } from "./chat-room.repository";
import { ChatRoomMemberRepository } from "./chat-room-member.repository";
import { MessageRepository } from "./message.repository";
import { TypedEventEmitter } from "./typed-event-emitter";

@Module({
	imports: [RedisModule, UserModule],
	providers: [
		ChatService,
		ChatGateway,
		TypedEventEmitter,
		MessageRepository,
		ChatRoomMemberRepository,
		ChatRoomRepository,
	],
})
export class ChatModule {}
