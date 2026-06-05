import { defineConfig } from "drizzle-kit";

const {
	PG_HOST = "localhost",
	PG_PORT = "5432",
	PG_USERNAME = "postgres",
	PG_PASSWORD = "postgres",
	PG_DBNAME = "fastsns",
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
	},
});
