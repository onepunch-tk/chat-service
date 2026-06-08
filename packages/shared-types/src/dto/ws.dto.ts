import type { MessageDto, SendMessageInput } from "./chat.dto";

/** server에서 클라이언트로 내려보내는 Error Message */
export interface WsErrorMessage {
	message: string;
	code: string | null;
	chatRoomId: number | null;
	timestamp: string;
}

/** 서버 -> 클라이언트 이벤트 타입*/
export interface ServerToClientEvents {
	chatMessage: (message: MessageDto) => void;
	error: (error: WsErrorMessage) => void;
}

/** 클라이언트 -> 서버 이벤트 타입 */
export interface ClientToServerEvents {
	sendMessage: (input: SendMessageInput) => void;
}

export const clientEvent = <K extends keyof ClientToServerEvents>(key: K) =>
	key;
