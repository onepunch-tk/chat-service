import type { INestApplication } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { RequestHandler } from "express";
import type { RedisClientType } from "redis";
import { Server, ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {
	private adapter!: ReturnType<typeof createAdapter>;

	// Bun isolated linker가 @nestjs/core를 2벌로 쪼개(앱 core ≠ websockets가 보는 core),
	// AbstractWsAdapter의 `app instanceof NestApplication`이 실패한다. 그 분기를 타면
	// httpServer 대신 app 객체가 저장돼 socket.io가 app.listeners()를 호출하다 크래시한다.
	// http 서버를 직접 넘겨 instanceof 경로 자체를 우회한다.
	constructor(
		app: INestApplication,
		private readonly sessionMiddleware: RequestHandler,
	) {
		super(app.getHttpServer());
	}

	async connect(redisClient: RedisClientType) {
		const pubClient = redisClient;

		const subClient = redisClient.duplicate();
		await subClient.connect();

		this.adapter = createAdapter(pubClient, subClient);
	}

	createIOServer(port: number, options?: ServerOptions) {
		const server: Server = super.createIOServer(port, options);
		server.adapter(this.adapter);

		// 핸드쉐이크 HTTP 요청에 express-session을 태운다.
		// 이후 게이트웨이에서 socket.request.session 접근 가능
		server.engine.use(this.sessionMiddleware);

		return server;
	}
}
