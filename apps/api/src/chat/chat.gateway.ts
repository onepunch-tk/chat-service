import {
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
} from "@nestjs/websockets";
import { clientEvent } from "@repo/shared-types";
import { Socket } from "socket.io";

@WebSocketGateway({ transport: ["websocket"] })
export class ChatGateway implements OnGatewayConnection {
	handleConnection(socket: Socket) {
		throw new Error("Method not implemented.");
	}

	@SubscribeMessage(clientEvent("sendMessage"))
	async handleSendMessage() {}
}
