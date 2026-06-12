import { sendMessageSchema } from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
