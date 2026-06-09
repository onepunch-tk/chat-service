import * as z from "zod";
/** offset 기반 페이지네이션 응답 — 원본 Spring `Page<T>`에 대응한다. */
export interface OffsetPage<T> {
	items: T[];
	/** WHERE에 매칭되는 전체 건수(Spring `Page.totalElements`) — repo에서 별도 count 쿼리로 채운다. */
	total: number;
	limit: number;
	offset: number;
}

/** 유저 검색 요청 — 관련도(trigram similarity)순 정렬 + offset 페이지네이션. */
export const searchQuerySchema = z.object({
	// 빈 문자열은 `%%`로 전체 매칭돼 무의미하므로 최소 1자.
	// (trigram 인덱스는 3자 이상부터 가속되지만, 그 미만도 seq scan으로 동작은 한다.)
	query: z
		.string({ error: "검색어는 필수입니다." })
		.trim()
		.min(2, { error: "검색어는 2자 이상이어야 합니다." }),
	limit: z.int().min(1).max(100).default(20),
	offset: z.int().min(0).default(0),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
