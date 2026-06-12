import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@repo/shared-types";
import type { Server, Socket } from "socket.io";

// 서버 : Server<수신, 송신>
// 클라이언트 : io<수신(ServerToClientEvents), 송신(ClientToServerEvents)>
export type WsServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type WsSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
