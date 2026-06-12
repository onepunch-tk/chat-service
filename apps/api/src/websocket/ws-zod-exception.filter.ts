import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { formatZodError } from "@repo/shared-types";
import { ZodValidationException } from "nestjs-zod";
import type { WsSocket } from "./ws.types";

@Catch(ZodValidationException)
export class WsZodExceptionFilter implements ExceptionFilter {
	catch(exception: ZodValidationException, host: ArgumentsHost) {
		const message =
			formatZodError(exception.getZodError()) ?? exception.message;
		const client = host.switchToWs().getClient<WsSocket>();

		client.emit("exception", {
			message,
			code: "VALIDATION_ERROR",
			chatRoomId: null,
			timestamp: new Date().toISOString(),
		});
	}
}
