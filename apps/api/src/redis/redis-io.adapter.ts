import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { RedisClientType } from "redis";
import { Server, ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {
	private adapter!: ReturnType<typeof createAdapter>;

	async connect(redisClient: RedisClientType) {
		const pubClient = redisClient;

		const subClient = redisClient.duplicate();
		await subClient.connect();

		this.adapter = createAdapter(pubClient, subClient);
	}

	createIOServer(port: number, options?: ServerOptions) {
		const server: Server = super.createIOServer(port, options);
		server.adapter(this.adapter);

		return server;
	}
}
