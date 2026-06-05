import { InsertUser, SelectUser } from "@repo/db/schemas";
import * as z from "zod";
import { Serialized } from "./serialized";

export interface UserDto
	extends Serialized<Omit<SelectUser, "password" | "updatedAt">> {}

export const CreateUserRequest = z.object({
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
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const LoginRequest = z.object({
	username: z
		.string({ error: "사용자명은 필수입니다." })
		.trim()
		.min(1, { error: "사용자명은 필수입니다." }),
	password: z
		.string({ error: "비밀번호는 필수입니다." })
		.min(1, { error: "비밀번호는 필수입니다." }),
}) satisfies z.ZodType<Pick<InsertUser, "username" | "password">>;
export type LoginRequest = z.infer<typeof LoginRequest>;
