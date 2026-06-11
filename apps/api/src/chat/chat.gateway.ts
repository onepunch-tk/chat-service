import { Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import {
	type ClientToServerEvents,
	clientEvent,
	MessageDto,
	type ServerToClientEvents,
} from "@repo/shared-types";
import { Server, Socket } from "socket.io";
import { roomChannel, userChannel } from "./chat.channels";
import { type ChatDomainEvents, chatEvent } from "./chat.events";

@WebSocketGateway({ transports: ["websocket"] })
export class ChatGateway implements OnGatewayConnection {
	private readonly logger = new Logger(ChatGateway.name);

	// 이벤트 맵 제네릭으로 emit의 이벤트 이름·payload를 컴파일 타임에 강제한다.
	@WebSocketServer()
	private readonly server: Server<ClientToServerEvents, ServerToClientEvents>;

	/**
	 * 신규 소켓 연결을 받는다 — 현재는 디버그 로깅만.
	 *
	 * @param socket 연결된 소켓
	 */
	handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
		this.logger.debug(`connected: ${socket.id}`);
	}

	@SubscribeMessage(clientEvent("sendMessage"))
	async handleSendMessage() {
		// TODO: sendMessage 유스케이스 구현 — 현재는 미구현 스텁.
	}

	/**
	 * chatRoom.memberJoined 수신 — 가입자의 활성 소켓들을 방 채널에 합류시킨다.
	 *
	 * @param payload 가입 이벤트(userId, roomId)
	 */
	@OnEvent(chatEvent("chatRoom.memberJoined"))
	handleChatRoomMemberJoined(
		payload: ChatDomainEvents["chatRoom.memberJoined"],
	) {
		this.addUserSocketsToRoom(payload.userId, payload.roomId);
	}

	/**
	 * chatRoom.memberLeft 수신 — 탈퇴자의 소켓들을 방 채널에서 제거한다.
	 *
	 * @param payload 탈퇴 이벤트(userId, roomId)
	 */
	@OnEvent(chatEvent("chatRoom.memberLeft"))
	handleChatRoomMemberLeft(payload: ChatDomainEvents["chatRoom.memberLeft"]) {
		this.removeUserSocketsFromRoom(payload.userId, payload.roomId);
	}

	/**
	 * message.sent 수신 — 확정된 메시지를 방 채널로 브로드캐스트한다.
	 *
	 * @param payload 전송 이벤트(roomId, message)
	 */
	@OnEvent(chatEvent("message.sent"))
	handleMessageSent(payload: ChatDomainEvents["message.sent"]) {
		this.broadcastMessageToRoom(payload.roomId, payload.message);
	}

	/**
	 * 방 채널 전원에게 chatMessage 이벤트를 송신한다 — server.to라 발신자 소켓도
	 * 포함된다(멀티탭 동기화·단일 진실 경로 의도, docs/learn의
	 * socketio-broadcast-ack-optimistic-ui-정합 참고).
	 *
	 * @param roomId 대상 방 id
	 * @param message 브로드캐스트할 확정 MessageDto
	 */
	broadcastMessageToRoom(roomId: number, message: MessageDto) {
		this.server.to(roomChannel(roomId)).emit("chatMessage", message);
	}

	/**
	 * 유저의 모든 활성 소켓(멀티탭·크로스 인스턴스)을 방 채널에 합류시킨다 — layer-3
	 * 소켓 라우팅. DB 멤버십(layer-1)은 서비스 트랜잭션(joinMember)이 담당한다.
	 *
	 * @param userId 대상 유저 id
	 * @param roomId 합류할 방 id
	 */
	addUserSocketsToRoom(userId: number, roomId: number) {
		this.server.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
	}

	/**
	 * 유저의 모든 활성 소켓을 방 채널에서 제거한다 — addUserSocketsToRoom의 역방향.
	 *
	 * @param userId 대상 유저 id
	 * @param roomId 떠날 방 id
	 */
	removeUserSocketsFromRoom(userId: number, roomId: number) {
		this.server.in(userChannel(userId)).socketsLeave(roomChannel(roomId));
	}
}
