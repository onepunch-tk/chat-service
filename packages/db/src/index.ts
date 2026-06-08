export { getTableColumns } from "drizzle-orm";
export { alias } from "drizzle-orm/pg-core";
// 쿼리 연산자(eq, and, sql 등) 재수출 — 소비 측은 drizzle-orm을 직접 의존하지 않고
// @repo/db 한 곳에서 버전을 단일 관리한다. (isolated linker에서 phantom dep 방지)
export * from "drizzle-orm/sql";
export * from "./client";
export * as schema from "./schemas";
