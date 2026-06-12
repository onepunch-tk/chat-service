import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { RedisStore } from "connect-redis";
import session from "express-session";
import { RedisClientType } from "redis";
import { AppModule } from "./app.module";
import {
	REDIS_CLIENT,
	REDIS_SESSION_PREFIX,
	SESSION_TTL_SECONDS,
} from "./redis/redis.constant";
import { RedisIoAdapter } from "./redis/redis-io.adapter";

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const redisClient = app.get<RedisClientType>(REDIS_CLIENT);
	const config = app.get(ConfigService);

	const sessionMiddleware = session({
		store: new RedisStore({
			client: redisClient,
			prefix: REDIS_SESSION_PREFIX,
		}),
		secret: config.getOrThrow<string>("SESSION_SECRET"),
		resave: false,
		saveUninitialized: false,
		rolling: true, // HTTP 응답마다 쿠키 maxAge 리셋 (WS 쪽 rolling은 touch()가 담당)
		cookie: {
			httpOnly: true,
			sameSite: "lax",
			maxAge: SESSION_TTL_SECONDS * 1000,
		},
	});

	app.use(sessionMiddleware);
	app.enableCors({ origin: "http://localhost:5173", credentials: true });

	const redisIoAdapter = new RedisIoAdapter(app, sessionMiddleware);
	await redisIoAdapter.connect(redisClient);
	app.useWebSocketAdapter(redisIoAdapter);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
