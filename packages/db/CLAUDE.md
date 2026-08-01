# @repo/db

Drizzle ORM 스키마 + PostgreSQL 클라이언트. 모노레포의 **DB 타입·쿼리 연산자 단일 소스**.

## Layout

- `src/index.ts` — 패키지 루트. client 재수출 + `schema` 네임스페이스 + **drizzle 쿼리 연산자**(`eq`/`and`/`sql` 등) + `getTableColumns` · `alias` 재수출
- `src/client.ts` — `createDbClient(config, logger?)` → `{ db, close }`, 타입 `DrizzleDB` · `DbConfig` · `DbClient`
- `src/schemas/index.ts` — 전체 테이블 스키마 barrel
- `src/schemas/columns.ts` — 공유 컬럼 빌더 `id` · `createdAt` · `timestamps`
- `src/schemas/{user,chat-room,chat-room-member,message}.schema.ts` — 테이블 + `relations` + `Insert*`/`Select*` 타입 + enum(`ChatRoomType` 등)
- `drizzle/drizzle.config.ts` — drizzle-kit 설정
- `drizzle/migrations/` — 생성된 SQL 마이그레이션 + `meta/`

진입점 export는 `.`(루트)과 `./schemas` 두 개 (`package.json` `exports` 참고).

## Commands

명령은 `packages/db`에서 실행한다.

```sh
bun run build      # tsc -p tsconfig.build.json → dist/
bun run typecheck  # tsc --noEmit
bun run db:generate  # 스키마 → 마이그레이션 SQL 생성
bun run db:migrate   # 마이그레이션 적용
bun run db:push      # 스키마 직접 push (개발용)
bun run db:studio    # drizzle studio
```

## Non-obvious rules

- **연산자는 여기서만 import.** 소비 측(apps/api 등)은 `drizzle-orm`을 직접 의존하지 않고 `@repo/db`에서 `eq`/`and`/`sql` 등을 가져온다. Bun isolated linker에서 `drizzle-orm`을 직접 import하면 phantom dependency로 하드 실패한다. 버전도 여기서 단일 관리. (`src/index.ts`)
- **dist로만 소비된다.** apps/api·`@repo/shared-types`는 이 패키지를 `dist/*.d.ts`로만 타입 해석한다. 스키마 수정 직후 dist 재빌드 전이면 LSP가 **stale dist 기반 가짜 타입 에러**를 낸다 — 단일 파일 typecheck 말고 `turbo typecheck`(또는 build)로 확인할 것.
- **`drizzle.config.ts`의 `ssl: false`는 의도된 것.** drizzle-kit은 ssl 미지정 시 truthy 기본값으로 SSL 접속을 시도하는데, 로컬 PG는 SSL 미지원이라 에러가 TUI에 삼켜져 조용히 `exit 1` 한다.
- **새 테이블은 `columns.ts` 빌더를 스프레드.** `...id`(bigint identity PK, `mode: "number"`) · `...timestamps`(created+updated, `updated_at`은 `$onUpdate(now())`)로 일관성 유지. 멤버십·메시지처럼 created만 필요하면 `...createdAt`.
- **메시지 순서는 방별 시퀀스.** `chat_rooms.lastSeq`(단조 카운터) + `messages.sequenceNumber`(방 내 unique). PK가 아니라 이 시퀀스가 정렬·페이지네이션 기준이다.
- trigram 검색 인덱스: `users.username`/`displayName`, `chat_rooms.name`에 `gin_trgm_ops` GIN 인덱스 — `pg_trgm` extension 필요.

## Cross-module

- **소비** → `apps/api`(`createDbClient` + schema + 연산자), `@repo/shared-types`(Insert/Select·enum 타입을 type-only import) — `packages/shared-types/CLAUDE.md`
- 경계 규칙 전반은 루트 `CLAUDE.md` 참고.
