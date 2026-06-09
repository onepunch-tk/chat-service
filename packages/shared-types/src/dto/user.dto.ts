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
	// bcrypt는 앞 72바이트만 사용하므로(초과분은 조용히 잘림) 바이트 기준 상한을 둔다.
	// Buffer는 FE 번들에서 못 쓰므로 TextEncoder로 UTF-8 바이트 수를 센다.
	password: z
		.string({ error: "비밀번호는 필수입니다." })
		.min(3, { error: "비밀번호는 최소 3자 이상이어야 합니다." })
		.refine((v) => new TextEncoder().encode(v).length <= 72, {
			error: "비밀번호는 72바이트를 초과할 수 없습니다.",
		}),
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
		.min(1, { error: "비밀번호는 필수입니다." })
		.refine((v) => new TextEncoder().encode(v).length <= 72, {
			error: "비밀번호는 72바이트를 초과할 수 없습니다.",
		}),
}) satisfies z.ZodType<Pick<InsertUser, "username" | "password">>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * 유저 응답 표현 — 원본 Spring `User` 엔티티의 wire 형태.
 * 목록/검색 응답은 별도 별칭 없이 `OffsetPage<UserDto>`를 직접 사용한다 (원본 `Page<User>`).
 */
export type UserDto = Serialized<Omit<SelectUser, "password" | "updatedAt">>;
