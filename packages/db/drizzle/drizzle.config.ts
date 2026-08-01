import { defineConfig } from "drizzle-kit";

const {
	PG_HOST = "localhost",
	PG_PORT = "5432",
	PG_USERNAME = "postgres",
	PG_PASSWORD = "postgres",
	PG_DBNAME = "chat-service",
} = process.env;

// 경로는 config 파일 위치가 아니라 명령 실행 위치(packages/db) 기준이다.
export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schemas/index.ts",
	out: "./drizzle/migrations",
	dbCredentials: {
		host: PG_HOST,
		port: Number(PG_PORT),
		user: PG_USERNAME,
		password: PG_PASSWORD,
		database: PG_DBNAME,
		// drizzle-kit은 ssl 미지정 시 {}(truthy)를 기본값으로 써서 SSL 접속을 시도한다.
		// 로컬 PG는 SSL 미지원 → 에러는 TUI에 삼켜져 조용히 exit 1. 명시적으로 끈다.
		ssl: false,
	},
});
