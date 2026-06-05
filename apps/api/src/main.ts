import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { REDIS_CLIENT } from "./redis/redis.constant";
import { RedisIoAdapter } from "./redis/redis-io.adapter";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const redisClient = app.get(REDIS_CLIENT);

	const redisIoAdapter = new RedisIoAdapter(app);
	await redisIoAdapter.connect(redisClient);
	app.useWebSocketAdapter(redisIoAdapter);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
