import { Logger, UseFilters, UseGuards, UsePipes } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { clientEvent, MessageDto } from "@repo/shared-types";
import { ZodValidationPipe } from "nestjs-zod";
import { ChatService } from "../chat/chat.service";
import {
	ChatDomainEvents,
	chatEvent,
	SessionDomainEvents,
	sessionEvent,
} from "../events/domain.events";
import { WsSessionGuard } from "../session/ws-session.guard";
import { SendMessageDto } from "./dto/send-message.dto";
import { roomChannel, sessionChannel, userChannel } from "./ws.channels";
import type { WsServer, WsSocket } from "./ws.types";
import { WsZodExceptionFilter } from "./ws-zod-exception.filter";

/**
 * 이 앱의 유일한 WS 엣지(어댑터) — 도메인 이벤트(@OnEvent)를 소켓 브로드캐스트로,
 * 클라이언트 이벤트(@SubscribeMessage)를 도메인 서비스 호출로 변환한다.
 * 도메인 로직은 갖지 않는다. 의존 방향은 어댑터 → 도메인 단방향.
 */
@UsePipes(ZodValidationPipe)
@UseFilters(WsZodExceptionFilter)
@UseGuards(WsSessionGuard)
@WebSocketGateway({ transports: ["websocket"] })
export class WsGateway implements OnGatewayConnection {
	private readonly logger = new Logger(WsGateway.name);
	// 이벤트 맵 제네릭으로 emit의 이벤트 이름·payload를 컴파일 타임에 강제한다.
	@WebSocketServer()
	private readonly server: WsServer;

	constructor(private readonly chatService: ChatService) {}

	/**
	 * 신규 소켓 연결을 인증하고 라우팅 채널을 구축한다.
	 *
	 * @param socket 연결된 소켓 (핸드셰이크 미들웨어가 request.session을 주입함)
	 */
	async handleConnection(socket: WsSocket) {
		const session = socket.request.session;
		if (!session?.userId) {
			socket.disconnect(true);
			return;
		}

		// user 채널 join은 bulk-join 조회보다 먼저여야 한다 — 조회 중 도착하는
		// memberJoined의 socketsJoin(user:{id})이 이 소켓을 잡으려면 이미 채널에
		// 있어야, connect 중 생성·가입된 방의 누락 창이 닫힌다.
		socket.join(userChannel(session.userId));
		socket.join(sessionChannel(session.id));

		try {
			const roomIds = await this.chatService.getActiveRoomIds(session.userId);
			socket.join(roomIds.map((r) => roomChannel(r.id)));
		} catch (e) {
			this.logger.error(`bulk-join 실패: userId=${session.userId}`, e);
		}
	}

	@SubscribeMessage(clientEvent("sendMessage"))
	async handleSendMessage(
		@MessageBody() body: SendMessageDto,
		@ConnectedSocket() client: WsSocket,
	) {
		// TODO: sendMessage 유스케이스 구현 — 현재는 미구현 스텁.
		this.logger.debug(body);
		this.logger.debug(client.id);
		return body;
	}

	@SubscribeMessage(clientEvent("heartBeat"))
	handleHeartBeat() {
		return "pong";
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
	 * session.terminated 수신 — 종료된 세션의 모든 소켓(멀티탭·크로스 인스턴스)을 끊는다.
	 * 로그아웃과 중복 로그인 kick이 같은 경로를 탄다. 권한 원본(Redis 세션)은 발행 측이
	 * 이미 제거했으므로, 끊긴 클라이언트가 재연결해도 handleConnection 입구에서 거부된다.
	 *
	 * @param payload 종료 이벤트(sessionId)
	 */

	@OnEvent(sessionEvent("session.terminated"))
	handleSessionTerminated(payload: SessionDomainEvents["session.terminated"]) {
		this.server.in(sessionChannel(payload.sessionId)).disconnectSockets(true);
	}

	/**
	 * 방 채널 전원에게 chatMessage 이벤트를 송신한다 — server.to라 발신자 소켓도
	 * 포함된다.
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
