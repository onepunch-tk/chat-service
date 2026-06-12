import "express-session";
import { Session, SessionData } from "express-session";

declare module "express-session" {
	interface SessionData {
		userId?: number;
	}
}

declare module "http" {
	interface IncomingMessage {
		session: Session & Partial<SessionData>;
	}
}
