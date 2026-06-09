/**
 * SQL LIKE/ILIKE 패턴에 사용자 입력을 끼워 넣기 전에 와일드카드 메타문자를 이스케이프한다.
 * `%`, `_`, `\` 를 리터럴로 처리해 의도치 않은 와일드카드 매칭(예: "%%" → 전체 매칭)을 막는다.
 * Drizzle이 패턴 문자열을 파라미터로 바인딩하므로 SQL injection과는 별개이며, 검색 정확도/오남용
 * 방지를 위한 처리다. (PostgreSQL LIKE 기본 escape 문자가 백슬래시라 ESCAPE 절은 불필요.)
 */
export function escapeLike(input: string): string {
	return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
