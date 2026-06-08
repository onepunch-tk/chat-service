import type { InsertUser, SelectUser } from "@repo/db/schemas";
import * as z from "zod";
import type { Serialized } from "./serialized";

export const createUserSchema = z.object({
	username: z
		.string({ error: "사용자명은 필수입니다." })
		.trim()
		.min(3, { error: "사용자명은 3-20자 사이여야 합니다." })
		.max(20, { error: "사용자명은 3-20자 사이여야 합니다." }),
	// 비밀번호는 입력값을 변조하면 안 되므로 trim하지 않는다.
	password: z
		.string({ error: "비밀번호는 필수입니다." })
		.min(3, { error: "비밀번호는 최소 3자 이상이어야 합니다." }),
	displayName: z
		.string({ error: "표시 이름은 필수입니다." })
		.trim()
		.min(1, { error: "표시 이름은 1-50자 사이여야 합니다." })
		.max(50, { error: "표시 이름은 1-50자 사이여야 합니다." }),
}) satisfies z.ZodType<
	Pick<InsertUser, "username" | "password" | "displayName">
>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const loginSchema = z.object({
	username: z
		.string({ error: "사용자명은 필수입니다." })
		.trim()
		.min(1, { error: "사용자명은 필수입니다." }),
	password: z
		.string({ error: "비밀번호는 필수입니다." })
		.min(1, { error: "비밀번호는 필수입니다." }),
}) satisfies z.ZodType<Pick<InsertUser, "username" | "password">>;
export type LoginInput = z.infer<typeof loginSchema>;

/** offset 기반 페이지네이션 응답 — 원본 Spring `Page<T>`에 대응한다. */
export interface OffsetPage<T> {
	items: T[];
	/** WHERE에 매칭되는 전체 건수(Spring `Page.totalElements`) — repo에서 별도 count 쿼리로 채운다. */
	total: number;
	limit: number;
	offset: number;
}

/** 유저 검색 요청 — 관련도(trigram similarity)순 정렬 + offset 페이지네이션. */
export const searchUserSchema = z.object({
	// 빈 문자열은 `%%`로 전체 매칭돼 무의미하므로 최소 1자.
	// (trigram 인덱스는 3자 이상부터 가속되지만, 그 미만도 seq scan으로 동작은 한다.)
	query: z
		.string({ error: "검색어는 필수입니다." })
		.trim()
		.min(2, { error: "검색어는 2자 이상이어야 합니다." }),
	limit: z.int().min(1).max(100).default(20),
	offset: z.int().min(0).default(0),
});
export type SearchUserInput = z.infer<typeof searchUserSchema>;

/**
 * 유저 응답 표현 — 원본 Spring `User` 엔티티의 wire 형태.
 * 목록/검색 응답은 별도 별칭 없이 `OffsetPage<UserDto>`를 직접 사용한다 (원본 `Page<User>`).
 */
export type UserDto = Serialized<Omit<SelectUser, "password" | "updatedAt">>;
