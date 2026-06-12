import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import type { WsSocket } from "../websocket/ws.types";
import { SessionService } from "./session.service";

@Injectable()
export class WsSessionGuard implements CanActivate {
	constructor(private readonly sessionService: SessionService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const socket = context.switchToWs().getClient<WsSocket>();
		const sessionId = socket.request.session.id;

		const result = await this.sessionService.touch(sessionId);
		if (result === "INVALID") {
			socket.disconnect(true);
			throw new WsException("세션이 만료되었습니다.");
		}

		return true;
	}
}
