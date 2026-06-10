import { Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { clientEvent } from "@repo/shared-types";
import { Server, Socket } from "socket.io";
import { roomChannel, userChannel } from "./chat.channels";
import { type ChatDomainEvents, chatEvent } from "./chat.events";

@WebSocketGateway({ transports: ["websocket"] })
export class ChatGateway implements OnGatewayConnection {
	private readonly logger = new Logger(ChatGateway.name);
	@WebSocketServer() private readonly server: Server;

	handleConnection(socket: Socket) {
		this.logger.debug(`connected: ${socket.id}`);
	}

	@SubscribeMessage(clientEvent("sendMessage"))
	async handleSendMessage() {
		// TODO: sendMessage 유스케이스 구현 — 현재는 미구현 스텁.
	}

	@OnEvent(chatEvent("chatRoom.created"))
	handleChatRoomCreated(payload: ChatDomainEvents["chatRoom.created"]) {
		this.addUserSocketsToRoom(payload.creatorId, payload.roomId);
	}

	@OnEvent(chatEvent("chatRoom.memberLeft"))
	handleChatRoomMemberLeft(payload: ChatDomainEvents["chatRoom.memberLeft"]) {
		this.removeUserSocketsFromRoom(payload.userId, payload.roomId);
	}

	/**
	 * 유저의 모든 활성 소켓(멀티탭·크로스 인스턴스)을 방 채널에 join/leave시킨다 — layer-3
	 * 소켓 라우팅. DB 멤버십(layer-1)은 서비스 트랜잭션(joinMember/leave)이 담당한다.
	 */
	addUserSocketsToRoom(userId: number, roomId: number) {
		this.server.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
	}

	removeUserSocketsFromRoom(userId: number, roomId: number) {
		this.server.in(userChannel(userId)).socketsLeave(roomChannel(roomId));
	}
}
