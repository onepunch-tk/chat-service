import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_PIPE } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ZodValidationPipe } from "nestjs-zod";
import { ChatModule } from "./chat/chat.module";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { SessionModule } from "./session/session.module";
import { UserModule } from "./user/user.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
		EventEmitterModule.forRoot(),
		DatabaseModule,
		RedisModule,
		UserModule,
		ChatModule,
		SessionModule,
	],
	controllers: [],
	providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
