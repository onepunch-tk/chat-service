/** JSON 직렬화 후의 응답 형태 — Date 필드는 wire에서 ISO string이 된다. */
export type Serialized<T> = {
	[K in keyof T]: T[K] extends Date
		? string
		: T[K] extends Date | null
			? string | null
			: T[K];
};
