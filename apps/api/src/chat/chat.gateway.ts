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
import type { ChatDomainEvents } from "./chat.events";

@WebSocketGateway({ transports: ["websocket"] })
export class ChatGateway implements OnGatewayConnection {
	@WebSocketServer() private readonly server: Server;

	handleConnection(socket: Socket) {
		throw new Error("Method not implemented.");
	}

	@SubscribeMessage(clientEvent("sendMessage"))
	async handleSendMessage() {
		// TODO: sendMessage 유스케이스 구현 — 현재는 미구현 스텁.
	}

	@OnEvent("chatRoom.created")
	handleChatRoomCreated(payload: ChatDomainEvents["chatRoom.created"]) {
		this.joinUserSocketsToRoom(payload.creatorId, payload.roomId);
	}

	/**
	 * 유저의 모든 활성 소켓(멀티탭·크로스 인스턴스)을 방 채널에 join시킨다 — layer-3 소켓
	 * 라우팅. DB 멤버십(layer-1)은 createChatRoom 트랜잭션의 joinMember가 담당하므로
	 * 여기선 다루지 않는다.
	 */
	joinUserSocketsToRoom(userId: number, roomId: number) {
		this.server.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
	}
}
