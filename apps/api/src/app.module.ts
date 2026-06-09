import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { UserModule } from "./user/user.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
		DatabaseModule,
		RedisModule,
		UserModule,
	],
	controllers: [],
	providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
